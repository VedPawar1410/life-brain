from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All config comes from env vars (or backend/.env). Real env vars win over .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://localhost/life_brain"
    # Browser origins allowed to call the API (the Next.js dev server by default).
    cors_origins: list[str] = ["http://localhost:3000"]

    # LLM: any OpenAI-compatible API. Defaults point at Groq's free tier.
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    capture_model: str = "openai/gpt-oss-20b"
    ask_model: str = "openai/gpt-oss-120b"
    fallback_model: str = "openai/gpt-oss-20b"

    # Optional paid fallback: Claude, used only when every Groq model is rate-limited or down.
    # Leave ANTHROPIC_API_KEY empty to never pay (Claude is then skipped entirely).
    anthropic_api_key: str = ""
    claude_model: str = "claude-haiku-5-5"
    # Order providers are tried in. ["groq"] = free only; ["claude"] = Claude only (eval).
    providers: list[str] = ["groq", "claude"]


settings = Settings()
