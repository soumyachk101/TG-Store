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
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("database_url_sync", mode="before")
    @classmethod
    def validate_database_url_sync(cls, v: Any) -> Any:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg2://", 1)
            elif v.startswith("postgresql://"):
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
        
        # Derive Firebase Project ID if not explicitly set
        if not self.firebase_project_id:
            import json
            import os
            # Try to load from json string
            if self.firebase_service_account_json:
                try:
                    info = json.loads(self.firebase_service_account_json)
                    self.firebase_project_id = info.get("project_id", "")
                except Exception:
                    pass
            # Try to load from path
            if not self.firebase_project_id and self.firebase_service_account_path:
                path = self.firebase_service_account_path
                if os.path.exists(path):
                    try:
                        with open(path, "r") as f:
                            info = json.load(f)
                            self.firebase_project_id = info.get("project_id", "")
                    except Exception:
                        pass
                else:
                    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                    alternative_path = os.path.join(backend_root, os.path.basename(path))
                    if os.path.exists(alternative_path):
                        try:
                            with open(alternative_path, "r") as f:
                                info = json.load(f)
                                self.firebase_project_id = info.get("project_id", "")
                        except Exception:
                            pass
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

    # --- Runtime environment ---
    # Set to "production" on Railway / Vercel / any real deployment.
    # "development" (default) skips the fail-closed safety checks below so
    # the local dev loop still works with .env.example values.
    environment: str = Field(
        default="development",
        description="Runtime environment: 'development' or 'production'. "
                    "Triggers fail-closed checks at startup.",
    )

    @model_validator(mode="after")
    def production_safety_checks(self) -> "Settings":
        """Refuse to boot in production with dev defaults or missing secrets.

        Closes the silent-fallback paths that turn a leaked .env into a full
        auth bypass (CRIT-3 mock auth, HIGH-8 HS256 fallback, LOW-5 dev
        defaults). Without ENVIRONMENT=production set on the host, a fresh
        deploy with an empty .env would boot with admin_password="changeme"
        and jwt_secret="dev-secret-change-me" — and a leaked /download-url
        bot token is the only thing standing between the attacker and
        /auth/login. This validator makes that misconfiguration impossible
        in production.
        """
        if self.environment != "production":
            return self
        if self.firebase_mock_auth:
            raise ValueError(
                "FIREBASE_MOCK_AUTH must be false in production. "
                "Set ENVIRONMENT=development for local mock-auth work."
            )
        if self.jwt_secret == "dev-secret-change-me":
            raise ValueError(
                "JWT_SECRET is set to the dev default. Rotate it before "
                "running in production (openssl rand -hex 32)."
            )
        if self.admin_password == "changeme":
            raise ValueError(
                "ADMIN_PASSWORD is set to the dev default. Rotate it before "
                "running in production."
            )
        if not self.firebase_service_account_path and not self.firebase_service_account_json:
            raise ValueError(
                "Production requires either FIREBASE_SERVICE_ACCOUNT_PATH "
                "or FIREBASE_SERVICE_ACCOUNT_JSON to be set. "
                "Firebase token verification will otherwise fall through to "
                "the HS256 path, which is disabled in production."
            )
        return self

    # --- Firebase ---
    firebase_service_account_path: str = Field(default="", description="Path to firebase service account JSON file")
    firebase_service_account_json: str = Field(default="", description="Serialized Firebase service account JSON string")
    firebase_project_id: str = Field(default="", description="Firebase Project ID")
    firebase_mock_auth: bool = Field(default=False, description="Enable mock verification for testing/local development")

    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — read once per process."""
    return Settings()
