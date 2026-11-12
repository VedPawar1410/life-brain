"""Run the capture + ask eval against the real LLM and write a JSON report.

    cd backend && uv run python -m evals.run --out reports/eval-<name>.json

Calls the LLM functions directly with in-memory entries: nothing touches the database.
Paced to fit Groq's free tier (8K tokens/minute); a full run takes ~4 minutes.
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
            model=meta.get("model"), fallback=meta.get("fallback"), usage=usage,
            first_token_s=round(first_token or 0, 2), secs=round(time.time() - start, 2), answer=text,
        ))
        print(("PASS" if results[-1]["ok"] else "FAIL"), "ask     |", question[:70], flush=True)
        time.sleep(pause)
    return results


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

    capture, ask = run_capture(args.pause), run_ask(args.pause)
    commit = subprocess.run(["git", "describe", "--always", "--dirty"], capture_output=True, text=True).stdout.strip()
    report = {
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_commit": commit,
        "models": {"capture": settings.capture_model, "ask": settings.ask_model, "fallback": settings.fallback_model},
        "brain_entries": len(BRAIN),
        "summary": summarize(capture, ask),
        "capture": capture,
        "ask": ask,
    }
    with open(args.out, "w") as f:
        json.dump(report, f, indent=1)
    print(json.dumps(report["summary"], indent=1))


if __name__ == "__main__":
    main()
