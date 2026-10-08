RAIN = {
    "title": "Getting soaked in the rain",
    "kind": "routine",
    "situation": "Come home wet from rain",
    "to_do": ["Hot shower", "Ginger tea"],
    "to_avoid": ["Sitting in wet clothes"],
    "tags": ["Rain", " cold ", "rain"],
}


def test_create_and_get(client):
    res = client.post("/entries", json=RAIN)
    assert res.status_code == 201
    entry = res.json()
    assert entry["id"] == 1
    assert entry["to_do"] == ["Hot shower", "Ginger tea"]
    assert entry["tags"] == ["rain", "cold"]  # normalized + de-duplicated

    assert client.get(f"/entries/{entry['id']}").json()["title"] == RAIN["title"]


def test_create_rejects_bad_kind_and_empty_title(client):
    assert client.post("/entries", json={**RAIN, "kind": "banana"}).status_code == 422
    assert client.post("/entries", json={**RAIN, "title": ""}).status_code == 422


def test_list_search_and_tag_filter(client):
    client.post("/entries", json=RAIN)
    client.post("/entries", json={"title": "Banana then water", "situation": "after fruit", "tags": ["food"]})

    assert len(client.get("/entries").json()) == 2
    assert [e["title"] for e in client.get("/entries", params={"q": "BANANA"}).json()] == ["Banana then water"]
    assert [e["title"] for e in client.get("/entries", params={"tag": "Rain"}).json()] == [RAIN["title"]]


def test_patch_only_changes_sent_fields(client):
    entry_id = client.post("/entries", json=RAIN).json()["id"]
    res = client.patch(f"/entries/{entry_id}", json={"notes": "Works every time", "tags": ["Throat"]})
    assert res.status_code == 200
    body = res.json()
    assert body["notes"] == "Works every time"
    assert body["tags"] == ["throat"]
    assert body["to_do"] == RAIN["to_do"]  # untouched


def test_delete_and_404s(client):
    entry_id = client.post("/entries", json=RAIN).json()["id"]
    assert client.delete(f"/entries/{entry_id}").status_code == 204
    assert client.get(f"/entries/{entry_id}").status_code == 404
    assert client.patch(f"/entries/{entry_id}", json={"notes": "x"}).status_code == 404
    assert client.delete(f"/entries/{entry_id}").status_code == 404
