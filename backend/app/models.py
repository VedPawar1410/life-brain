from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Entry(Base):
    """One piece of personal know-how, e.g. 'banana + water → bloating'."""

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    # issue | remedy | routine | preference | fact — validated in schemas.py
    kind: Mapped[str] = mapped_column(String(20), default="issue")
    situation: Mapped[str] = mapped_column(Text, default="")  # when / what triggers it
    what_happens: Mapped[str] = mapped_column(Text, default="")  # how my body reacts
    # Postgres arrays keep short lists in the row itself — no join tables needed for a POC.
    to_do: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    to_avoid: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    source_text: Mapped[str] = mapped_column(Text, default="")  # original words, never lost
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Ask(Base):
    """One question asked of the brain and the answer it gave (history + learning loop)."""

    __tablename__ = "asks"

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    model_used: Mapped[str] = mapped_column(String(100))
    # Entries the answer actually cited ([#id]), not everything that was in the prompt.
    entry_ids_used: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
