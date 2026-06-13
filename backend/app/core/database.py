"""Async SQLAlchemy engine + session factory."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# Pool tuning only applies to real RDBMS drivers (asyncpg, psycopg2).
# SQLite (used in tests) doesn't support these kwargs and rejects them.
_is_sqlite = settings.database_url.startswith("sqlite")

engine_kwargs: dict = dict(
    echo=False,
    pool_pre_ping=not _is_sqlite,
)
if not _is_sqlite:
    engine_kwargs.update(pool_size=5, max_overflow=10)

engine = create_async_engine(settings.database_url, **engine_kwargs)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async session, ensures cleanup."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
