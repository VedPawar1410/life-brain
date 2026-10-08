"""The only module that talks to the LLM.

We use the standard `openai` SDK pointed at Groq's OpenAI-compatible endpoint, so the
provider is pure config (LLM_BASE_URL / LLM_API_KEY / model names in .env).
"""

import json
from collections.abc import Iterator
from functools import lru_cache

from openai import APIError, OpenAI, RateLimitError
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


def _compact(entries: list[Entry]) -> str:
    """One short line per entry. Tokens matter: Groq's free tier allows ~8K tokens/minute."""
    if not entries:
        return "(none yet)"
    return "\n".join(f"{e.id} | {e.title} | {e.situation} | {', '.join(e.tags)}" for e in entries)


def extract_entry(text: str, existing: list[Entry]) -> CaptureDraft:
    """Ask the LLM to structure `text`. Validated with Pydantic, retried once on bad output."""
    messages = [
        {"role": "system", "content": CAPTURE_SYSTEM_PROMPT.format(existing=_compact(existing))},
        {"role": "user", "content": text},
    ]
    for attempt in range(2):
        response = get_client().chat.completions.create(
            model=settings.capture_model,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "entry_draft", "strict": True, "schema": CAPTURE_SCHEMA},
            },
            reasoning_effort="low",  # extraction needs little; duplicates get a tag-overlap backstop
            temperature=0.2,
        )
        raw = response.choices[0].message.content or ""
        try:
            return CaptureDraft.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as err:
            # Strict mode should prevent this, but open models occasionally slip. Feed the
            # error back once so the model can correct itself, then give up.
            if attempt == 1:
                raise ValueError(f"LLM returned an invalid draft: {err}") from err
            messages += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"That was invalid ({err}). Reply with corrected JSON only."},
            ]
    raise AssertionError("unreachable")


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
- Their personal entries take priority over generic advice, EXCEPT safety: if anything \
suggests an emergency (e.g. chest pain, trouble breathing, signs of stroke, severe \
allergic reaction, suicidal thoughts), START the answer with a bold line telling them to \
seek emergency help now, before any other section.
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

    Falls back to the smaller model on a 429. That error arrives before any tokens are
    streamed, so the retry is invisible to the user apart from the model name.
    """
    messages = [
        {"role": "system", "content": ASK_SYSTEM_PROMPT.format(entries=_full(entries))},
        {"role": "user", "content": question},
    ]
    stream = None
    for model in dict.fromkeys([settings.ask_model, settings.fallback_model]):  # de-duped, ordered
        try:
            stream = get_client().chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                stream_options={"include_usage": True},
                reasoning_effort="medium",
                max_completion_tokens=2000,
                extra_body={"include_reasoning": False},  # Groq: don't stream the model's thinking
            )
            break
        except RateLimitError:
            continue
    if stream is None:
        yield {"type": "error", "message": "Rate limit hit on all models, try again in a minute."}
        return

    yield {"type": "meta", "model": model, "fallback": model != settings.ask_model}
    usage = None
    try:
        for chunk in stream:
            if chunk.usage:
                usage = {"prompt_tokens": chunk.usage.prompt_tokens, "completion_tokens": chunk.usage.completion_tokens}
            if chunk.choices and chunk.choices[0].delta.content:
                yield {"type": "delta", "text": chunk.choices[0].delta.content}
    except APIError as err:
        yield {"type": "error", "message": f"LLM error mid-answer: {err}"}
        return
    yield {"type": "done", "usage": usage}
