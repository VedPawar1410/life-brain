from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import Base, engine
from app.routers import entries


@asynccontextmanager
async def lifespan(_: FastAPI):
    # POC shortcut: create tables on startup instead of migrations.
    # Swap for Alembic once the schema stops changing.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Life Brain API", lifespan=lifespan)
app.include_router(entries.router)


@app.get("/health")
def health():
    return {"status": "ok"}
