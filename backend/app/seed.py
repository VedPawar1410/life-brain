"""Load the demo brain into an empty database: `uv run python -m app.seed`.

The demo brain is the synthetic 8-entry brain the eval uses (evals/cases.py), so what you
try by hand is exactly what the eval measures. To keep your own brain untouched, point it
at a separate database:

    createdb life_brain_demo
    DATABASE_URL=postgresql+psycopg://localhost/life_brain_demo uv run python -m app.seed
"""

from sqlalchemy import func, select

from app.db import Base, SessionLocal, engine
from app.models import Entry
from evals.cases import BRAIN

FIELDS = ["title", "kind", "situation", "what_happens", "to_do", "to_avoid", "notes", "tags", "source_text"]


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Entry)):
            print("Brain already has entries — skipping seed.")
            return
        # Copy the fields, not the ids: let Postgres assign ids so later inserts don't collide.
        db.add_all(Entry(**{f: getattr(e, f) for f in FIELDS}) for e in BRAIN)
        db.commit()
        print(f"Seeded {len(BRAIN)} demo entries.")


if __name__ == "__main__":
    main()
