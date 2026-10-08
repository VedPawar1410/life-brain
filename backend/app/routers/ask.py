import json
import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import llm
from app.db import SessionLocal, get_db
from app.models import Ask, Entry
from app.schemas import AskRead

router = APIRouter(tags=["ask"])


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)


@router.post("/ask")
def ask(body: AskRequest, db: Session = Depends(get_db)):
    """Stream the answer as NDJSON: one JSON event per line.

    Events: entries, meta, delta…, then done (+ saved) or error.
    """
    entries = llm.select_entries(body.question, list(db.scalars(select(Entry).order_by(Entry.id))))
    known_ids = {e.id for e in entries}

    def events():
        yield _line({"type": "entries", "ids": sorted(known_ids)})
        answer, model, usage = "", "", None
        for event in llm.stream_answer(body.question, entries):
            yield _line(event)
            if event["type"] == "meta":
                model = event["model"]
            elif event["type"] == "delta":
                answer += event["text"]
            elif event["type"] == "done":
                usage = event["usage"] or {}
            elif event["type"] == "error":
                return  # don't keep half-answers in history

        # Saved only after the full answer has streamed. Uses its own session: the request's
        # session isn't guaranteed to still be open while a streaming response is running.
        with SessionLocal() as session:
            record = Ask(
                question=body.question,
                answer=answer,
                model_used=model,
                entry_ids_used=cited_ids(answer, known_ids),
                prompt_tokens=usage.get("prompt_tokens"),
                completion_tokens=usage.get("completion_tokens"),
            )
            session.add(record)
            session.commit()
            yield _line({"type": "saved", "ask_id": record.id})

    return StreamingResponse(events(), media_type="application/x-ndjson")


def cited_ids(answer: str, known_ids: set[int]) -> list[int]:
    """Entry ids cited as [#id] in the answer, in order of first use, ignoring invented ones."""
    ids = dict.fromkeys(int(m) for m in re.findall(r"\[#(\d+)\]", answer))
    return [i for i in ids if i in known_ids]


@router.get("/asks", response_model=list[AskRead])
def list_asks(limit: int = 20, db: Session = Depends(get_db)):
    return db.scalars(select(Ask).order_by(Ask.id.desc()).limit(min(limit, 100))).all()


@router.get("/asks/{ask_id}", response_model=AskRead)
def get_ask(ask_id: int, db: Session = Depends(get_db)):
    record = db.get(Ask, ask_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ask not found")
    return record


@router.delete("/asks/{ask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ask(ask_id: int, db: Session = Depends(get_db)):
    db.delete(get_ask(ask_id, db))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _line(event: dict) -> str:
    return json.dumps(event) + "\n"
