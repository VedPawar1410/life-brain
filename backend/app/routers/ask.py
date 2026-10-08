import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import llm
from app.db import get_db
from app.models import Entry

router = APIRouter(tags=["ask"])


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)


@router.post("/ask")
def ask(body: AskRequest, db: Session = Depends(get_db)):
    """Stream the answer as NDJSON: one JSON event per line (meta, delta…, done | error)."""
    entries = llm.select_entries(body.question, list(db.scalars(select(Entry).order_by(Entry.id))))

    def events():
        yield _line({"type": "entries", "ids": [e.id for e in entries]})
        for event in llm.stream_answer(body.question, entries):
            yield _line(event)

    return StreamingResponse(events(), media_type="application/x-ndjson")


def _line(event: dict) -> str:
    return json.dumps(event) + "\n"
