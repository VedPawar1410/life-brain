from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All config comes from env vars (or backend/.env). Real env vars win over .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://localhost/life_brain"
    # Browser origins allowed to call the API (the Next.js dev server by default).
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
