"""Core: configuration loaded from environment variables.

All secrets come from os.getenv / .env — never hardcode.
"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Telegram ---
    bot_token: str = Field(default="", description="Telegram bot token from @BotFather")
    chat_id: str = Field(default="", description="Private channel id (negative number)")

    # --- Database ---
    database_url: str = Field(
        default="postgresql+asyncpg://tgstore:tgstore@localhost:5432/tgstore",
        description="Async SQLAlchemy database URL",
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg2://tgstore:tgstore@localhost:5432/tgstore",
        description="Sync URL for Alembic",
    )

    # --- Auth ---
    jwt_secret: str = Field(
        default="dev-secret-change-me", description="HS256 signing key"
    )
    jwt_expire_hours: int = Field(default=24, ge=1, le=168)
    admin_username: str = Field(default="admin")
    admin_password: str = Field(default="changeme")

    # --- CORS ---
    allowed_origins: str = Field(
        default="http://localhost:3000",
        description="Comma-separated allowed CORS origins",
    )

    # --- Upload limits ---
    max_upload_bytes: int = Field(
        default=2 * 1024 * 1024 * 1024,
        description="Max upload size in bytes (Telegram limit is 2 GB)",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — read once per process."""
    return Settings()
