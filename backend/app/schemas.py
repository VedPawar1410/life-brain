from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EntryKind = Literal["issue", "remedy", "routine", "preference", "fact"]


def _clean_tags(tags: list[str]) -> list[str]:
    """Lowercase, trim and de-duplicate tags so filtering is predictable."""
    seen: list[str] = []
    for tag in tags:
        tag = tag.strip().lower()
        if tag and tag not in seen:
            seen.append(tag)
    return seen


class EntryBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: EntryKind = "issue"
    situation: str = ""
    what_happens: str = ""
    to_do: list[str] = []
    to_avoid: list[str] = []
    notes: str = ""
    tags: list[str] = []
    source_text: str = ""

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str]) -> list[str]:
        return _clean_tags(tags)


class EntryCreate(EntryBase):
    pass


class EntryUpdate(BaseModel):
    """PATCH body: every field optional, only the ones sent get changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: EntryKind | None = None
    situation: str | None = None
    what_happens: str | None = None
    to_do: list[str] | None = None
    to_avoid: list[str] | None = None
    notes: str | None = None
    tags: list[str] | None = None
    source_text: str | None = None

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str] | None) -> list[str] | None:
        return None if tags is None else _clean_tags(tags)


class EntryRead(EntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class AskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    answer: str
    model_used: str
    entry_ids_used: list[int]
    prompt_tokens: int | None
    completion_tokens: int | None
    created_at: datetime
