from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Entry
from app.schemas import EntryCreate, EntryRead, EntryUpdate

router = APIRouter(prefix="/entries", tags=["entries"])


def _get_or_404(db: Session, entry_id: int) -> Entry:
    entry = db.get(Entry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


@router.get("", response_model=list[EntryRead])
def list_entries(q: str | None = None, tag: str | None = None, db: Session = Depends(get_db)):
    """List entries, newest first. `q` = text search, `tag` = exact tag filter."""
    stmt = select(Entry).order_by(Entry.updated_at.desc())
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Entry.title.ilike(pattern),
                Entry.situation.ilike(pattern),
                Entry.what_happens.ilike(pattern),
                Entry.notes.ilike(pattern),
            )
        )
    if tag:
        stmt = stmt.where(Entry.tags.contains([tag.strip().lower()]))  # Postgres @>
    return db.scalars(stmt).all()


@router.post("", response_model=EntryRead, status_code=status.HTTP_201_CREATED)
def create_entry(body: EntryCreate, db: Session = Depends(get_db)):
    entry = Entry(**body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=EntryRead)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, entry_id)


@router.patch("/{entry_id}", response_model=EntryRead)
def update_entry(entry_id: int, body: EntryUpdate, db: Session = Depends(get_db)):
    entry = _get_or_404(db, entry_id)
    # exclude_unset: a field you didn't send stays as-is (vs. being reset to None).
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, entry_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _union(old: list[str], new: list[str]) -> list[str]:
    """Keep old items in order, append new ones not already present (case-insensitive)."""
    seen = {item.lower() for item in old}
    return old + [item for item in new if item.lower() not in seen]


def _append_text(old: str, new: str, sep: str = "\n") -> str:
    if not new or new in old:
        return old
    return f"{old}{sep}{new}" if old else new


@router.post("/{entry_id}/merge", response_model=EntryRead)
def merge_entry(entry_id: int, body: EntryCreate, db: Session = Depends(get_db)):
    """Fold a new draft into an existing entry without losing anything.

    Plain rules instead of asking the LLM to merge: predictable, testable, and free.
    Title and kind stay as they were; lists are unioned; text is appended.
    """
    entry = _get_or_404(db, entry_id)
    entry.situation = _append_text(entry.situation, body.situation)
    entry.what_happens = _append_text(entry.what_happens, body.what_happens)
    entry.notes = _append_text(entry.notes, body.notes)
    entry.to_do = _union(entry.to_do, body.to_do)
    entry.to_avoid = _union(entry.to_avoid, body.to_avoid)
    entry.tags = _union(entry.tags, body.tags)
    entry.source_text = _append_text(entry.source_text, body.source_text, sep="\n---\n")
    db.commit()
    db.refresh(entry)
    return entry
