import os

# Point the app at the test database *before* app modules create their engine.
os.environ["DATABASE_URL"] = "postgresql+psycopg://localhost/life_brain_test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

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
