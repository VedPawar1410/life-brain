"""Run the capture + ask eval against the real LLM and write a JSON report.

    cd backend && uv run python -m evals.run --out reports/eval-<name>.json

Calls the LLM functions directly with in-memory entries: nothing touches the database.
Paced to fit Groq's free tier (8K tokens/minute); a full run takes ~4 minutes.
Evaluate Claude alone (paid, ~$0.01 per run on Haiku 5.5):
    PROVIDERS='["claude"]' uv run python -m evals.run --pause 1 --out reports/eval-claude.json
"""

import argparse
import json
import re
import subprocess
import time
from datetime import datetime, timezone

from app import llm
from app.config import settings
from app.routers.capture import resolve_duplicate
from evals.cases import ASK_CASES, BRAIN, CAPTURE_CASES, UNRELATED_TO_HIKE

IDS = {e.id for e in BRAIN}

# $ per 1M tokens (input, output) for paid models, to report what a run actually cost.
# Claude Haiku 5.5 list price, Nov 2026. Groq's free tier costs nothing.
PRICES = {"claude-haiku-5-5": (0.10, 0.50)}


class ClaudeMeter:
    """Wraps the Claude client to add up real token usage of non-streaming calls (capture).
    Streaming calls (ask) report usage through their `done` event instead."""

    def __init__(self, client):
        self._client, self.input_tokens, self.output_tokens = client, 0, 0
        self.messages = self

    def create(self, **kwargs):
        response = self._client.messages.create(**kwargs)
        self.input_tokens += response.usage.input_tokens
        self.output_tokens += response.usage.output_tokens
        return response

    def stream(self, **kwargs):
        return self._client.messages.stream(**kwargs)


def run_capture(pause: float) -> list[dict]:
    results = []
    for note, acceptable, require_empty_to_do in CAPTURE_CASES:
        start = time.time()
        try:
            draft = llm.extract_entry(note, BRAIN)
            llm_alone = draft.possible_duplicate_id if draft.possible_duplicate_id in IDS else None
            final = resolve_duplicate(draft, BRAIN).possible_duplicate_id
            checks = {"duplicate": final in acceptable}
            if require_empty_to_do:
                checks["no_invented_advice"] = not draft.to_do
            results.append(dict(
                case=note, ok=all(checks.values()), checks=checks, acceptable=sorted(acceptable, key=str),
                llm_alone_dup=llm_alone, final_dup=final, tags=draft.tags, to_do=draft.to_do,
                secs=round(time.time() - start, 2),
            ))
        except Exception as err:  # a crash is a failed case, not a crashed eval
            results.append(dict(case=note, ok=False, error=f"{type(err).__name__}: {err}"[:300]))
        print(("PASS" if results[-1]["ok"] else "FAIL"), "capture |", note[:70], flush=True)
        time.sleep(pause)
    return results


def run_ask(pause: float) -> list[dict]:
    results = []
    for question, must_cite, extra in ASK_CASES:
        start, text, meta, usage, first_token = time.time(), "", {}, None, None
        for event in llm.stream_answer(question, llm.select_entries(question, BRAIN)):
            if event["type"] == "delta":
                first_token = first_token or time.time() - start
                text += event["text"]
            elif event["type"] == "meta":
                meta = event
            elif event["type"] == "done":
                usage = event["usage"]
            elif event["type"] == "error":
                text = "ERROR " + event["message"]
        cited = {int(i) for i in re.findall(r"\[#(\d+)\]", text)}
        checks = {
            "answered": not text.startswith("ERROR"),
            "cites_expected": must_cite <= cited,
            "no_invented_ids": cited <= IDS,
        }
        if extra == "emergency_first":
            checks["emergency_first"] = bool(re.search(r"emergenc|911|112|ambulance", text[:250], re.I))
        if extra == "no_unrelated_citations":
            checks["no_unrelated_citations"] = not (cited & UNRELATED_TO_HIKE)
        results.append(dict(
            case=question, ok=all(checks.values()), checks=checks, cited=sorted(cited),
            model=meta.get("model"), provider=meta.get("provider"), fallback=meta.get("fallback"), usage=usage,
            first_token_s=round(first_token or 0, 2), secs=round(time.time() - start, 2), answer=text,
        ))
        print(("PASS" if results[-1]["ok"] else "FAIL"), "ask     |", question[:70], flush=True)
        time.sleep(pause)
    return results


def claude_cost(meter: ClaudeMeter, ask: list[dict]) -> dict | None:
    claude_asks = [r for r in ask if r.get("provider") == "claude" and r.get("usage")]
    if not (meter.input_tokens or claude_asks):
        return None
    tokens_in = meter.input_tokens + sum(r["usage"]["prompt_tokens"] for r in claude_asks)
    tokens_out = meter.output_tokens + sum(r["usage"]["completion_tokens"] for r in claude_asks)
    price_in, price_out = PRICES.get(settings.claude_model, (0, 0))
    return {
        "input_tokens": tokens_in,
        "output_tokens": tokens_out,
        "usd": round((tokens_in * price_in + tokens_out * price_out) / 1e6, 5),
        "usd_per_ask": round(sum(r["usage"]["prompt_tokens"] * price_in + r["usage"]["completion_tokens"] * price_out
                                 for r in claude_asks) / 1e6 / max(len(claude_asks), 1), 6),
    }


def summarize(capture: list[dict], ask: list[dict]) -> dict:
    answered = [r for r in ask if r.get("usage")]
    avg = lambda values: round(sum(values) / len(values), 2) if values else None
    return {
        "capture_pass": f"{sum(r['ok'] for r in capture)}/{len(capture)}",
        "capture_llm_alone_dup_correct": f"{sum(r.get('llm_alone_dup') in set(r.get('acceptable', [])) for r in capture)}/{len(capture)}",
        "ask_pass": f"{sum(r['ok'] for r in ask)}/{len(ask)}",
        "ask_avg_total_tokens": avg([r["usage"]["prompt_tokens"] + r["usage"]["completion_tokens"] for r in answered]),
        "ask_avg_prompt_tokens": avg([r["usage"]["prompt_tokens"] for r in answered]),
        "ask_avg_secs": avg([r["secs"] for r in answered]),
        "ask_avg_first_token_s": avg([r["first_token_s"] for r in answered]),
        "ask_fallbacks": sum(1 for r in answered if r.get("fallback")),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="reports/eval.json")
    parser.add_argument("--pause", type=float, default=15, help="seconds between calls (rate limits)")
    args = parser.parse_args()

    meter = ClaudeMeter(llm.get_claude_client())
    llm.get_claude_client = lambda: meter  # count every Claude call this run makes
    capture, ask = run_capture(args.pause), run_ask(args.pause)
    commit = subprocess.run(["git", "describe", "--always", "--dirty"], capture_output=True, text=True).stdout.strip()
    report = {
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_commit": commit,
        "models": {"capture": settings.capture_model, "ask": settings.ask_model, "fallback": settings.fallback_model,
                   "claude": settings.claude_model if settings.anthropic_api_key else None},
        "providers": settings.providers,
        "brain_entries": len(BRAIN),
        "summary": summarize(capture, ask),
        "claude_cost": claude_cost(meter, ask),
        "capture": capture,
        "ask": ask,
    }
    with open(args.out, "w") as f:
        json.dump(report, f, indent=1)
    print(json.dumps({**report["summary"], "claude_cost": report["claude_cost"]}, indent=1))


if __name__ == "__main__":
    main()
