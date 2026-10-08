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
    assert events[-2] == {"type": "done", "usage": {"prompt_tokens": 100, "completion_tokens": 20}}
    assert events[-1]["type"] == "saved"

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


def test_ask_saves_history_with_only_real_cited_ids(client, fake_llm):
    rain = client.post("/entries", json={"title": "Rain"}).json()
    client.post("/entries", json={"title": "Banana"})
    fake_llm(["Shower [#1]. Again [#1]. Made up [#99]."])

    events = _events(client.post("/ask", json={"question": "soaked, what now?"}))
    assert events[-1] == {"type": "saved", "ask_id": 1}

    saved = client.get("/asks/1").json()
    assert saved["question"] == "soaked, what now?"
    assert saved["answer"] == "Shower [#1]. Again [#1]. Made up [#99]."
    assert saved["model_used"] == "openai/gpt-oss-120b"
    assert saved["entry_ids_used"] == [rain["id"]]  # de-duped, invented #99 dropped
    assert saved["prompt_tokens"] == 100
    assert [a["id"] for a in client.get("/asks").json()] == [1]


def test_ask_error_is_not_saved(client, fake_llm):
    fake_llm(rate_limit_error(), rate_limit_error())
    _events(client.post("/ask", json={"question": "what now?"}))
    assert client.get("/asks").json() == []


def test_history_newest_first_and_delete(client, fake_llm):
    fake_llm(["one"], ["two"])
    client.post("/ask", json={"question": "first?"})
    client.post("/ask", json={"question": "second?"})
    assert [a["question"] for a in client.get("/asks").json()] == ["second?", "first?"]

    assert client.delete("/asks/1").status_code == 204
    assert client.get("/asks/1").status_code == 404
