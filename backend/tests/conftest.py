import json
import os
from types import SimpleNamespace

# Point the app at the test database *before* app modules create their engine.
os.environ["DATABASE_URL"] = "postgresql+psycopg://localhost/life_brain_test"

import httpx
import openai
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import llm
from app.db import Base, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE entries RESTART IDENTITY"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class FakeLLM:
    """Stands in for the OpenAI client: returns queued replies and records each call.

    A reply can be: dict (sent as JSON content), str (raw content), an Exception (raised),
    or a list of strings (streamed as chunks, followed by a usage chunk).
    """

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, list):
            return self._stream(reply)
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    @staticmethod
    def _stream(pieces):
        for text in pieces:
            yield _chunk(text)
        yield SimpleNamespace(choices=[], usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20))


def _chunk(text):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))], usage=None)


@pytest.fixture
def fake_llm(monkeypatch):
    def install(*replies):
        fake = FakeLLM(*replies)
        monkeypatch.setattr(llm, "get_client", lambda: fake)
        return fake

    return install


def rate_limit_error():
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    return openai.RateLimitError("slow down", response=httpx.Response(429, request=request), body=None)
