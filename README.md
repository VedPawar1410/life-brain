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

Setup instructions are added as each part lands.
