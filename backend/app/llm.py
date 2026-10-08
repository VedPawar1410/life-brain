"""The only module that talks to the LLM.

We use the standard `openai` SDK pointed at Groq's OpenAI-compatible endpoint, so the
provider is pure config (LLM_BASE_URL / LLM_API_KEY / model names in .env).
"""

import json
from functools import lru_cache

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
