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
6. Phone polish (installable PWA, voice input, Tailscale access)

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
cp .env.example .env.local   # optional: API_PROXY_TARGET, defaults to http://localhost:8000
npm install
npm run dev                  # → http://localhost:3000 (open at phone width)
```
The browser only talks to Next.js: `/api/*` is proxied to FastAPI (see `next.config.ts`),
so there's a single origin to expose and no CORS to configure.

### On your phone (installable app + voice) via Tailscale
Installing to the home screen and the microphone both require **HTTPS**. [Tailscale](https://tailscale.com)
gives your Mac a private HTTPS address that only *your* devices can reach. Important, because the
app has no login and holds health notes.

1. Install Tailscale on your Mac and phone, and sign in to the same account on both.
2. In the Tailscale admin console → **DNS**, enable **MagicDNS** and **HTTPS certificates**.
3. With the backend and frontend running, on the Mac:
   ```bash
   tailscale serve --bg 3000
   ```
   It prints `https://<your-mac>.<tailnet>.ts.net`. Open that on your phone.
4. Install: **iPhone**: Safari → Share → *Add to Home Screen*. **Android**: Chrome → ⋮ → *Install app*.

Stop sharing with `tailscale serve --https=443 off`. Only Next.js (port 3000) is shared;
FastAPI and Postgres stay bound to localhost. The dev and start scripts bind Next.js to
`127.0.0.1` too: it proxies `/api` to the backend, so listening on all interfaces (Next's
default) would expose your whole brain to anyone on the same Wi-Fi.

Voice input (🎙️ on Add and Ask) uses the browser's built-in Web Speech API, which isn't available
in Firefox. The button simply doesn't appear where it's unsupported.

### Entries API
| Method | Path | Notes |
|---|---|---|
| GET | `/entries?q=&tag=` | newest first; `q` = text search, `tag` = exact tag |
| POST | `/entries` | create |
| GET | `/entries/{id}` | |
| PATCH | `/entries/{id}` | only fields you send are changed |
| DELETE | `/entries/{id}` | |
| POST | `/entries/{id}/merge?preview=` | fold a draft into an entry: lists unioned, text appended. `preview=true` returns the result without saving |
| POST | `/capture` | `{text}` → structured draft + possible duplicate (nothing saved) |
| POST | `/ask` | `{question}` → NDJSON stream: `entries`, `meta` (model), `delta`…, `done` (usage) + `saved` (ask id), or `error` |
| GET | `/asks?limit=` | question/answer history, newest first |
| GET/DELETE | `/asks/{id}` | |

`POST /capture` also accepts `ask_id`: a "what worked" follow-up gets the original question + answer as context.
