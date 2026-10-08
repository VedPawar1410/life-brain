import openai
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import llm
from app.db import get_db
from app.models import Ask, Entry

router = APIRouter(tags=["capture"])


class CaptureRequest(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    # Set when capturing "what worked" after an answer: gives the LLM the original Q&A.
    ask_id: int | None = None


@router.post("/capture", response_model=llm.CaptureDraft)
def capture(body: CaptureRequest, db: Session = Depends(get_db)):
    """Free text -> draft entry. Nothing is saved: the user reviews the draft first."""
    entries = list(db.scalars(select(Entry).order_by(Entry.id)))
    context = None
    if body.ask_id is not None:
        ask = db.get(Ask, body.ask_id)
        if ask is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ask not found")
        context = (ask.question, ask.answer)
    try:
        draft = llm.extract_entry(body.text, entries, context=context)
    except openai.RateLimitError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "LLM rate limit hit, try again in a minute")
    except (openai.APIError, ValueError) as err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"LLM error: {err}")

    # Never trust an id the model made up.
    if draft.possible_duplicate_id not in {e.id for e in entries}:
        draft.possible_duplicate_id = None
        draft.duplicate_reason = None

    # Backstop: the small model often misses overlaps, so fall back to a cheap, deterministic
    # check. A false "maybe related" costs one tap; a missed one splits the brain in two.
    if draft.possible_duplicate_id is None:
        match = most_shared_tags(draft.tags, entries)
        if match:
            entry, shared = match
            draft.possible_duplicate_id = entry.id
            draft.duplicate_reason = f"Shares tags: {', '.join(shared)}"
    return draft


def most_shared_tags(tags: list[str], entries: list[Entry]) -> tuple[Entry, list[str]] | None:
    """The existing entry sharing the most tags with `tags`, if any share at least one."""
    wanted = {t.strip().lower() for t in tags}
    best: tuple[Entry, list[str]] | None = None
    for entry in entries:
        shared = [t for t in entry.tags if t in wanted]
        if shared and (best is None or len(shared) > len(best[1])):
            best = (entry, shared)
    return best
