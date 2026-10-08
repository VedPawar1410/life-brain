from tests.conftest import rate_limit_error

DRAFT = {
    "title": "Banana followed by water",
    "kind": "issue",
    "situation": "Drinking water right after a banana",
    "what_happens": "Bloating",
    "to_do": ["Wait 30 minutes before drinking water"],
    "to_avoid": [],
    "notes": "",
    "tags": ["food", "digestion"],
    "possible_duplicate_id": None,
    "duplicate_reason": None,
}


def test_capture_returns_draft_without_saving(client, fake_llm):
    fake = fake_llm(DRAFT)
    res = client.post("/capture", json={"text": "banana then water makes me bloated"})
    assert res.status_code == 200
    assert res.json()["title"] == "Banana followed by water"
    assert client.get("/entries").json() == []  # nothing saved until the user confirms

    call = fake.calls[0]
    assert call["model"] == "openai/gpt-oss-20b"
    assert call["response_format"]["json_schema"]["strict"] is True
    assert call["messages"][-1]["content"] == "banana then water makes me bloated"


def test_capture_sends_existing_entries_and_keeps_valid_duplicate(client, fake_llm):
    existing = client.post("/entries", json={"title": "Banana + water", "tags": ["food"]}).json()
    fake = fake_llm({**DRAFT, "possible_duplicate_id": existing["id"], "duplicate_reason": "Same thing"})

    body = client.post("/capture", json={"text": "banana and water again"}).json()
    assert body["possible_duplicate_id"] == existing["id"]
    assert f"{existing['id']} | Banana + water" in fake.calls[0]["messages"][0]["content"]


def test_capture_drops_made_up_duplicate_id(client, fake_llm):
    fake_llm({**DRAFT, "possible_duplicate_id": 999, "duplicate_reason": "hallucinated"})
    body = client.post("/capture", json={"text": "banana and water"}).json()
    assert body["possible_duplicate_id"] is None
    assert body["duplicate_reason"] is None


def test_capture_falls_back_to_tag_overlap_when_llm_misses_duplicate(client, fake_llm):
    client.post("/entries", json={"title": "Sleep", "tags": ["sleep"]})
    rain = client.post("/entries", json={"title": "Rain", "tags": ["rain", "cold"]}).json()
    fake_llm({**DRAFT, "tags": ["rain", "cold", "nose"]})  # LLM says: no duplicate

    body = client.post("/capture", json={"text": "warm socks after rain"}).json()
    assert body["possible_duplicate_id"] == rain["id"]
    assert body["duplicate_reason"] == "Shares tags: rain, cold"


def test_capture_no_duplicate_when_no_tags_overlap(client, fake_llm):
    client.post("/entries", json={"title": "Rain", "tags": ["rain"]})
    fake_llm(DRAFT)  # tags: food, digestion
    assert client.post("/capture", json={"text": "banana then water"}).json()["possible_duplicate_id"] is None


def test_capture_retries_once_on_invalid_json(client, fake_llm):
    fake = fake_llm("not json at all", DRAFT)
    res = client.post("/capture", json={"text": "banana then water"})
    assert res.status_code == 200
    assert len(fake.calls) == 2
    assert "invalid" in fake.calls[1]["messages"][-1]["content"]


def test_capture_gives_up_after_second_invalid_reply(client, fake_llm):
    fake_llm("nope", {**DRAFT, "kind": "banana"})
    assert client.post("/capture", json={"text": "banana then water"}).status_code == 502


def test_capture_maps_rate_limit_to_429(client, fake_llm):
    fake_llm(rate_limit_error())
    assert client.post("/capture", json={"text": "banana then water"}).status_code == 429


def test_merge_unions_lists_and_appends_text(client):
    entry = client.post(
        "/entries",
        json={
            "title": "Rain",
            "situation": "Wet from rain",
            "to_do": ["Hot shower"],
            "tags": ["rain"],
            "source_text": "first note",
        },
    ).json()

    res = client.post(
        f"/entries/{entry['id']}/merge",
        json={
            "title": "Ignored title",
            "situation": "Wet from rain",  # already there -> not duplicated
            "what_happens": "Sore throat",
            "to_do": ["hot shower", "Ginger tea"],  # case-insensitive de-dupe
            "tags": ["Rain", "throat"],
            "source_text": "second note",
        },
    )
    merged = res.json()
    assert merged["title"] == "Rain"
    assert merged["situation"] == "Wet from rain"
    assert merged["what_happens"] == "Sore throat"
    assert merged["to_do"] == ["Hot shower", "Ginger tea"]
    assert merged["tags"] == ["rain", "throat"]
    assert merged["source_text"] == "first note\n---\nsecond note"


def test_capture_follow_up_includes_original_question_and_answer(client, fake_llm):
    fake_llm(["Try ginger tea [#1]"])
    client.post("/ask", json={"question": "soaked in rain?"})

    fake = fake_llm(DRAFT)
    res = client.post("/capture", json={"text": "the ginger tea really helped", "ask_id": 1})
    assert res.status_code == 200
    system = fake.calls[0]["messages"][0]["content"]
    assert "Their question: soaked in rain?" in system
    assert "Try ginger tea [#1]" in system


def test_capture_follow_up_unknown_ask_is_404(client, fake_llm):
    fake_llm(DRAFT)
    assert client.post("/capture", json={"text": "it helped", "ask_id": 42}).status_code == 404
