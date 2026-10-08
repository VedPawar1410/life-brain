"""Real API calls. Skipped by default; run with `uv run pytest -m live`."""

import pytest

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
