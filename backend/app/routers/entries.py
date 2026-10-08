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
