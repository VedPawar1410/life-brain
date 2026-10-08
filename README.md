# Life Brain 🧠

A personal "second brain" for the things you learn about **your own body and life**.

- **Capture** — tell it something in plain words ("when I eat a banana and then drink water, I get bloated"). The AI turns it into a structured, editable entry.
- **Ask** — describe a situation ("I just got soaked in the rain"). The AI combines *your* entries with general knowledge and gives one concrete answer: what to do now, what to avoid next time.
- **Grow** — keep adding, editing and merging entries until it really is your second brain.

> ⚠️ This is a personal notebook, not medical advice.

## Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, mobile-first |
| Backend | Python / FastAPI / SQLAlchemy |
| Database | Postgres (local) |
| LLM | Groq free tier via the OpenAI-compatible API — `openai/gpt-oss-20b` (capture), `openai/gpt-oss-120b` (ask) |

## Roadmap (one PR per feature)
1. Backend foundation — entries CRUD API
2. Brain browser UI
3. AI capture (free text → structured entry, duplicate detection)
4. Ask (personal + general answer, streamed)
5. Learning loop (history, "save what worked")
6. Phone polish (PWA, voice input)

## Running locally

### Backend
Requires Postgres running locally and [uv](https://docs.astral.sh/uv/).

```bash
createdb life_brain && createdb life_brain_test
cd backend
cp .env.example .env
uv sync
uv run python -m app.seed          # optional: 2 generic example entries
uv run uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs · Tests: `uv run pytest` (LLM mocked, free) · Live LLM smoke test: `uv run pytest -m live`

### LLM (Groq free tier)
Get a free key at https://console.groq.com and set `LLM_API_KEY` in `backend/.env`.
Any OpenAI-compatible provider works — just change `LLM_BASE_URL` and the model names.

Free-tier limits (checked Oct 2026, see https://console.groq.com/docs/rate-limits):
**8K tokens/minute, 200K tokens/day, 30 requests/minute** per model. One capture uses ~1.5K tokens,
so that's about 5 captures/minute. Hitting the limit returns HTTP 429 → "try again in a minute".

### Frontend
```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:8000
npm install
npm run dev                  # → http://localhost:3000 (open at phone width)
```

### Entries API
| Method | Path | Notes |
|---|---|---|
| GET | `/entries?q=&tag=` | newest first; `q` = text search, `tag` = exact tag |
| POST | `/entries` | create |
| GET | `/entries/{id}` | |
| PATCH | `/entries/{id}` | only fields you send are changed |
| DELETE | `/entries/{id}` | |
| POST | `/entries/{id}/merge` | fold a draft into an entry: lists unioned, text appended |
| POST | `/capture` | `{text}` → structured draft + possible duplicate (nothing saved) |
