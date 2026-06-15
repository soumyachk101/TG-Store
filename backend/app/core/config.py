"""Core: configuration loaded from environment variables.

All secrets come from os.getenv / .env — never hardcode.
"""

from functools import lru_cache
from typing import Any, List

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, v: Any) -> Any:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("database_url_sync", mode="before")
    @classmethod
    def validate_database_url_sync(cls, v: Any) -> Any:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    @model_validator(mode="after")
    def derive_sync_url(self) -> "Settings":
        default_sync = "postgresql+psycopg2://tgstore:tgstore@localhost:5432/tgstore"
        if self.database_url_sync == default_sync or not self.database_url_sync:
            if self.database_url != "postgresql+asyncpg://tgstore:tgstore@localhost:5432/tgstore":
                self.database_url_sync = self.database_url.replace(
                    "postgresql+asyncpg://", "postgresql+psycopg2://", 1
                )
        return self


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

    # --- Firebase ---
    firebase_service_account_path: str = Field(default="", description="Path to firebase service account JSON file")
    firebase_service_account_json: str = Field(default="", description="Serialized Firebase service account JSON string")
    firebase_mock_auth: bool = Field(default=False, description="Enable mock verification for testing/local development")

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
