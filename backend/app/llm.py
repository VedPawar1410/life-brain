"""The only module that talks to LLMs.

Providers are tried in order (settings.providers) until one is available:
  groq   - the `openai` SDK pointed at Groq's OpenAI-compatible endpoint (free tier)
  claude - the `anthropic` SDK, an optional paid fallback (only if ANTHROPIC_API_KEY is set)

A provider is skipped only when it is *unavailable* (rate limit, connection error, 5xx) and
only before any output has been produced, so an answer never mixes two models.
"""

import json
from collections.abc import Callable, Iterator
from functools import lru_cache

import anthropic
import openai
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.models import Entry
from app.schemas import EntryKind

# --- Capture: free text -> structured draft entry -------------------------------------


class CaptureDraft(BaseModel):
    title: str
    kind: EntryKind
    situation: str
    what_happens: str
    to_do: list[str]
    to_avoid: list[str]
    notes: str
    tags: list[str]
    possible_duplicate_id: int | None
    duplicate_reason: str | None


# Hand-written rather than CaptureDraft.model_json_schema(): Groq's strict mode needs every
# property in `required`, `additionalProperties: false`, and nullables as ["type", "null"].
_STR_LIST = {"type": "array", "items": {"type": "string"}}
CAPTURE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "kind": {"type": "string", "enum": ["issue", "remedy", "routine", "preference", "fact"]},
        "situation": {"type": "string"},
        "what_happens": {"type": "string"},
        "to_do": _STR_LIST,
        "to_avoid": _STR_LIST,
        "notes": {"type": "string"},
        "tags": _STR_LIST,
        "possible_duplicate_id": {"type": ["integer", "null"]},
        "duplicate_reason": {"type": ["string", "null"]},
    },
    "required": [
        "title", "kind", "situation", "what_happens", "to_do", "to_avoid",
        "notes", "tags", "possible_duplicate_id", "duplicate_reason",
    ],
    "additionalProperties": False,
}

CAPTURE_SYSTEM_PROMPT = """\
You turn a person's quick note about their own body, health or daily life into one \
structured entry for their personal "second brain".

Fields:
- title: short and specific, max ~8 words (e.g. "Banana followed by water").
- kind: issue (a problem I get) | remedy (something that fixes something) | \
routine (what I do in a situation) | preference (what I like/dislike) | fact (about me).
- situation: when it happens / what triggers it.
- what_happens: how their body or mind reacts. Empty string if not mentioned.
- to_do / to_avoid: short imperative actions, one per item.
- notes: any other detail worth keeping. Empty string if none.
- tags: 1-4 lowercase topic words (e.g. "food", "sleep", "rain"). Reuse tags from the \
existing entries below whenever they fit, so related entries share tags.

Rules:
- Only record what the person actually said. Do NOT add advice, remedies or medical \
facts of your own. This is their personal record, not a recommendation.
- Write concisely, from the person's point of view.
- Duplicates: below are their existing entries. If the note is about the same \
situation or trigger as one of them (e.g. both are about getting wet in the rain, even if \
the details differ), set possible_duplicate_id to that id and give a one-sentence \
duplicate_reason. When unsure, flag it: the person decides whether to merge. If nothing \
overlaps, both are null.

Existing entries (id | title | situation | tags):
{existing}"""


@lru_cache
def get_client() -> OpenAI:
    return OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)


@lru_cache
def get_claude_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


class LLMUnavailable(Exception):
    """Every provider in the chain was rate-limited or down."""


def _is_unavailable(err: Exception) -> bool:
    """Worth trying the next provider? Yes for rate limits, network errors and 5xx;
    no for 4xx (a bad request would fail the same way everywhere)."""
    if isinstance(err, (openai.RateLimitError, openai.APIConnectionError,
                        anthropic.RateLimitError, anthropic.APIConnectionError)):
        return True
    return isinstance(err, (openai.APIStatusError, anthropic.APIStatusError)) and err.status_code >= 500


def _chain(groq_models: list[str]) -> list[tuple[str, str]]:
    """(provider, model) pairs in the order to try them."""
    chain = []
    for provider in settings.providers:
        if provider == "groq":
            chain += [("groq", model) for model in dict.fromkeys(groq_models)]  # de-duped, ordered
        elif provider == "claude" and settings.anthropic_api_key:
            chain.append(("claude", settings.claude_model))
    return chain


def _compact(entries: list[Entry]) -> str:
    """One short line per entry. Tokens matter: Groq's free tier allows ~8K tokens/minute."""
    if not entries:
        return "(none yet)"
    return "\n".join(f"{e.id} | {e.title} | {e.situation} | {', '.join(e.tags)}" for e in entries)


FOLLOW_UP_CONTEXT = """

This note is a follow-up to advice the person got from their second brain. Use it only to \
understand what they are referring to (e.g. "the ginger tea helped"); record what THEY \
report worked or didn't, not the advice itself.
Their question: {question}
The advice they got:
{answer}"""


def extract_entry(
    text: str, existing: list[Entry], context: tuple[str, str] | None = None
) -> CaptureDraft:
    """Ask the LLM to structure `text`. Validated with Pydantic, retried once on bad output.

    `context` = (question, answer) when the note follows up on an earlier Ask.
    """
    system = CAPTURE_SYSTEM_PROMPT.format(existing=_compact(existing))
    if context:
        system += FOLLOW_UP_CONTEXT.format(question=context[0], answer=context[1])

    last_error: Exception | None = None
    for provider, model in _chain([settings.capture_model]):
        try:
            return _extract_with(provider, model, system, text)
        except (openai.APIError, anthropic.APIError) as err:
            if not _is_unavailable(err):
                raise
            last_error = err
    raise LLMUnavailable("All LLM providers are rate-limited or unavailable") from last_error


def _extract_with(provider: str, model: str, system: str, text: str) -> CaptureDraft:
    """One provider, validated with Pydantic and retried once on bad output."""
    conversation = [{"role": "user", "content": text}]
    for attempt in range(2):
        raw = _json_completion(provider, model, system, conversation)
        try:
            return CaptureDraft.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as err:
            # Strict schemas should prevent this, but models occasionally slip. Feed the
            # error back once so the model can correct itself, then give up.
            if attempt == 1:
                raise ValueError(f"LLM returned an invalid draft: {err}") from err
            conversation += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"That was invalid ({err}). Reply with corrected JSON only."},
            ]
    raise AssertionError("unreachable")


def _json_completion(provider: str, model: str, system: str, conversation: list[dict]) -> str:
    """Raw JSON text constrained to CAPTURE_SCHEMA by the provider's structured output."""
    if provider == "groq":
        response = get_client().chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, *conversation],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "entry_draft", "strict": True, "schema": CAPTURE_SCHEMA},
            },
            reasoning_effort="low",  # extraction needs little; duplicates get a tag-overlap backstop
            temperature=0.2,
        )
        return response.choices[0].message.content or ""

    response = get_claude_client().messages.create(
        model=model,
        max_tokens=2000,  # cost cap; thinking counts toward it
        system=system,
        messages=conversation,
        # No temperature: Haiku 5.5 rejects non-default sampling values with a 400.
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": CAPTURE_SCHEMA}},
    )
    if response.stop_reason == "refusal":
        raise ValueError("Claude declined to structure this note")
    return next((block.text for block in response.content if block.type == "text"), "")


# --- Ask: question + the person's entries -> streamed advice ---------------------------

ASK_SYSTEM_PROMPT = """\
You are the person's "second brain": a helper that knows what they have learned about \
their own body and life (their entries below) and combines it with sound general knowledge.

Answer their situation with this exact markdown structure (skip a section only if it \
would be empty):

## From your brain
What their own entries say about this situation. Cite each entry you use as [#id], \
e.g. "A hot shower helps you [#1]". If no entry is relevant, say so in one line.

## General guidance
Widely accepted advice that adds to their entries. Keep it brief.

## Do now
- [ ] Concrete steps, in order. Their own proven steps first.

## Next time
- How to prevent or handle this better next time.

## See a doctor if
- Specific warning signs for this situation.

Rules:
- Their personal entries take priority over generic advice, EXCEPT safety: if the person \
describes symptoms happening NOW that may be an emergency (e.g. chest pain, trouble \
breathing, signs of stroke, severe allergic reaction, suicidal thoughts), START the answer \
with a bold line telling them to seek emergency help now, before any other section.
- Never add that emergency line for everyday questions (food, sleep, weather, habits). \
Warning signs that MIGHT appear later ("if you develop a fever...") belong only under \
"See a doctor if", never as a bold line at the top.
- You are not a doctor. Never diagnose; never tell them to stop prescribed medication.
- Be concise and practical. Bullets over paragraphs. No preamble.
- Only cite ids that appear below. Never invent entries.

Their entries:
{entries}"""


def select_entries(question: str, entries: list[Entry]) -> list[Entry]:
    """Which entries go into the prompt. All of them for now (the brain is small).

    This is the single seam to swap for retrieval (tag/keyword prefilter, then pgvector)
    once the full brain no longer fits Groq's free-tier tokens-per-minute budget.
    """
    return entries


def _full(entries: list[Entry]) -> str:
    """Compact but complete: one block per entry, only non-empty fields."""
    if not entries:
        return "(none yet)"
    blocks = []
    for e in entries:
        parts = [f"[#{e.id}] {e.title} ({e.kind})"]
        for label, value in [
            ("when", e.situation),
            ("reaction", e.what_happens),
            ("do", "; ".join(e.to_do)),
            ("avoid", "; ".join(e.to_avoid)),
            ("notes", e.notes),
            ("tags", ", ".join(e.tags)),
        ]:
            if value:
                parts.append(f"  {label}: {value}")
        blocks.append("\n".join(parts))
    return "\n".join(blocks)


def stream_answer(question: str, entries: list[Entry]) -> Iterator[dict]:
    """Yield events: {"type": "meta"|"delta"|"done"|"error", ...}.

    Tries each provider in the chain. Rate limits and outages surface before the first token,
    so falling back is invisible to the user apart from the model name in `meta`.
    """
    system = ASK_SYSTEM_PROMPT.format(entries=_full(entries))
    streamers: dict[str, Callable[[str, str, str], Iterator[dict]]] = {
        "groq": _stream_groq, "claude": _stream_claude,
    }
    for position, (provider, model) in enumerate(_chain([settings.ask_model, settings.fallback_model])):
        started = False
        try:
            for event in streamers[provider](model, system, question):
                if not started:
                    yield {"type": "meta", "model": model, "provider": provider, "fallback": position > 0}
                    started = True
                yield event
            return
        except (openai.APIError, anthropic.APIError) as err:
            if started or not _is_unavailable(err):
                yield {"type": "error", "message": f"LLM error: {err}"}
                return
    yield {"type": "error", "message": "Rate limit hit on all providers, try again in a minute."}


def _stream_groq(model: str, system: str, question: str) -> Iterator[dict]:
    stream = get_client().chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": question}],
        stream=True,
        stream_options={"include_usage": True},
        reasoning_effort="medium",
        max_completion_tokens=2000,
        extra_body={"include_reasoning": False},  # Groq: don't stream the model's thinking
    )
    usage = None
    for chunk in stream:
        if chunk.usage:
            usage = {"prompt_tokens": chunk.usage.prompt_tokens, "completion_tokens": chunk.usage.completion_tokens}
        if chunk.choices and chunk.choices[0].delta.content:
            yield {"type": "delta", "text": chunk.choices[0].delta.content}
    yield {"type": "done", "usage": usage}


def _stream_claude(model: str, system: str, question: str) -> Iterator[dict]:
    with get_claude_client().messages.stream(
        model=model,
        max_tokens=4000,  # cost cap; thinking counts toward it
        system=system,
        messages=[{"role": "user", "content": question}],
        output_config={"effort": "medium"},  # health answers deserve some thought
    ) as stream:
        for text in stream.text_stream:  # text only; thinking blocks are not streamed here
            yield {"type": "delta", "text": text}
        final = stream.get_final_message()
    if final.stop_reason == "refusal":
        yield {"type": "error", "message": "Claude declined to answer this question."}
        return
    yield {"type": "done", "usage": {"prompt_tokens": final.usage.input_tokens, "completion_tokens": final.usage.output_tokens}}
