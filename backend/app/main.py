from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.routers import ask, capture, entries


@asynccontextmanager
async def lifespan(_: FastAPI):
    # POC shortcut: create tables on startup instead of migrations.
    # Swap for Alembic once the schema stops changing.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Life Brain API", lifespan=lifespan)
# The frontend runs on a different port (= different origin), so the browser
# blocks its requests unless the API explicitly allows that origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(entries.router)
app.include_router(capture.router)
app.include_router(ask.router)


@app.get("/health")
def health():
    return {"status": "ok"}
