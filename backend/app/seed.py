"""Insert a few generic example entries into an empty brain: `uv run python -m app.seed`."""

from sqlalchemy import func, select

from app.db import Base, SessionLocal, engine
from app.models import Entry

EXAMPLES = [
    dict(
        title="Getting soaked in the rain",
        kind="routine",
        situation="Come home wet from rain",
        what_happens="Tend to get a sore throat the next day",
        to_do=["Hot shower straight away", "Dry hair fully", "Warm ginger tea"],
        to_avoid=["Sitting in wet clothes", "Cold drinks that evening"],
        tags=["rain", "cold", "throat"],
    ),
    dict(
        title="Banana followed by water",
        kind="issue",
        situation="Drinking water right after eating a banana",
        what_happens="Bloating and mild stomach discomfort",
        to_do=["Wait ~30 minutes before drinking water"],
        to_avoid=["Gulping water right after fruit"],
        tags=["food", "digestion"],
    ),
]


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Entry)):
            print("Brain already has entries — skipping seed.")
            return
        db.add_all(Entry(**e) for e in EXAMPLES)
        db.commit()
        print(f"Seeded {len(EXAMPLES)} example entries.")


if __name__ == "__main__":
    main()
