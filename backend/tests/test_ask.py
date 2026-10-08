import json

from tests.conftest import rate_limit_error


def _events(res):
    return [json.loads(line) for line in res.text.splitlines()]


def test_ask_streams_answer_with_entries_in_prompt(client, fake_llm):
    rain = client.post(
        "/entries", json={"title": "Rain", "situation": "Wet from rain", "to_do": ["Hot shower"]}
    ).json()
    fake = fake_llm(["## From your brain\n", "Hot shower [#1]"])

    res = client.post("/ask", json={"question": "I just got soaked, what now?"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")

    events = _events(res)
    assert events[0] == {"type": "entries", "ids": [rain["id"]]}
    assert events[1] == {"type": "meta", "model": "openai/gpt-oss-120b", "fallback": False}
    assert "".join(e["text"] for e in events if e["type"] == "delta") == "## From your brain\nHot shower [#1]"
    assert events[-1] == {"type": "done", "usage": {"prompt_tokens": 100, "completion_tokens": 20}}

    system = fake.calls[0]["messages"][0]["content"]
    assert "[#1] Rain (issue)" in system
    assert "do: Hot shower" in system
    assert "emergency" in system  # safety rules are always present
    assert fake.calls[0]["stream"] is True


def test_ask_falls_back_to_smaller_model_on_rate_limit(client, fake_llm):
    fake = fake_llm(rate_limit_error(), ["ok"])
    events = _events(client.post("/ask", json={"question": "what now?"}))
    assert events[1] == {"type": "meta", "model": "openai/gpt-oss-20b", "fallback": True}
    assert [c["model"] for c in fake.calls] == ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]


def test_ask_reports_error_when_all_models_rate_limited(client, fake_llm):
    fake_llm(rate_limit_error(), rate_limit_error())
    events = _events(client.post("/ask", json={"question": "what now?"}))
    assert events[-1]["type"] == "error"
    assert "Rate limit" in events[-1]["message"]


def test_ask_with_empty_brain_still_answers(client, fake_llm):
    fake = fake_llm(["General advice only"])
    events = _events(client.post("/ask", json={"question": "what now?"}))
    assert events[0] == {"type": "entries", "ids": []}
    assert "(none yet)" in fake.calls[0]["messages"][0]["content"]
