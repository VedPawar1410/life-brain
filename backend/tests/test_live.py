"""Real API calls. Skipped by default; run with `uv run pytest -m live`."""

import pytest
from dotenv import dotenv_values

from app import llm
from app.config import settings

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not settings.llm_api_key, reason="LLM_API_KEY not set"),
]


def test_live_capture_structures_a_note():
    draft = llm.extract_entry(
        "whenever I eat a banana and drink water right after, I get bloated for an hour", []
    )
    assert draft.title
    assert draft.kind in {"issue", "fact"}
    assert draft.possible_duplicate_id is None
    print("\n", draft.model_dump_json(indent=2))


# conftest blanks ANTHROPIC_API_KEY so ordinary tests can never spend money; this paid test
# opts in by reading the key from backend/.env itself.
CLAUDE_KEY = dotenv_values(".env").get("ANTHROPIC_API_KEY") or ""


@pytest.mark.skipif(not CLAUDE_KEY, reason="ANTHROPIC_API_KEY not set in backend/.env")
def test_live_claude_capture_structures_a_note(monkeypatch):
    """Paid: one Claude Haiku call, a fraction of a cent."""
    monkeypatch.setattr(settings, "anthropic_api_key", CLAUDE_KEY)
    monkeypatch.setattr(settings, "providers", ["claude"])
    llm.get_claude_client.cache_clear()
    draft = llm.extract_entry("eating curd at night gives me a cold and cough the next day", [])
    assert draft.title
    assert draft.possible_duplicate_id is None
    print("\n", draft.model_dump_json(indent=2))
