"""Backend tests: verify auth guard and 2GB cap on the upload endpoint.

All Telegram calls are mocked — never hit the real API in CI.
"""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

# Set test env BEFORE importing the app
os.environ.setdefault("JWT_SECRET", "test-secret-32-bytes-min-aaaaaa")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("BOT_TOKEN", "test-bot-token")
os.environ.setdefault("CHAT_ID", "-1001234567890")


@pytest.mark.asyncio
async def test_health_is_unauthenticated():
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_login_success_returns_jwt():
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/auth/login", json={"username": "admin", "password": "admin"}
        )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["expires_in"] > 0


@pytest.mark.asyncio
async def test_login_failure_returns_401():
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/auth/login", json={"username": "admin", "password": "wrong"}
        )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_requires_auth():
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/files")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_upload_2gb_cap_is_enforced_before_telegram():
    """Even with a malicious Content-Length, the body-too-large check must fire."""
    from app.main import app

    # Build a multipart payload that claims a size just over the cap.
    # The Starlette UploadFile will report `size` from Content-Length; we
    # patch get_settings to return a tiny cap so the test is fast.
    fake_file_content = b"x" * 16
    with patch("app.routers.files.settings") as fake_settings:
        fake_settings.max_upload_bytes = 8  # cap below our file

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            # Need an auth token to even reach the size check
            r = await c.post(
                "/auth/login", json={"username": "admin", "password": "admin"}
            )
            token = r.json()["access_token"]
            r = await c.post(
                "/files/upload",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("test.txt", fake_file_content, "text/plain")},
            )
        assert r.status_code == 413


@pytest.mark.asyncio
async def test_upload_happy_path_persists_metadata():
    """With a mocked Telegram call, the upload endpoint should return a FileResponse."""
    from app.main import app

    fake_telegram_result = {
        "document": {"file_id": "BAADBAADrwADBREAAYag"},
        "message_id": 42,
    }
    with patch(
        "app.routers.files.telegram.send_document",
        AsyncMock(return_value=fake_telegram_result),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            r = await c.post(
                "/auth/login", json={"username": "admin", "password": "admin"}
            )
            token = r.json()["access_token"]

            # SQLite in-memory needs table creation. Patch the DB session to
            # use StaticPool so all queries hit the same connection.
            from app.core import database as dbmod
            from sqlalchemy.ext.asyncio import (
                AsyncSession,
                async_sessionmaker,
                create_async_engine,
            )
            from sqlalchemy.pool import StaticPool

            test_engine = create_async_engine(
                "sqlite+aiosqlite:///:memory:",
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
            from app.models.db import Base  # noqa: F401
            async with test_engine.begin() as conn:
                await conn.run_sync(dbmod.Base.metadata.create_all)
            test_session = async_sessionmaker(
                bind=test_engine, class_=AsyncSession, expire_on_commit=False
            )

            async def override_get_db():
                async with test_session() as s:
                    yield s

            app.dependency_overrides[dbmod.get_db] = override_get_db
            try:
                r = await c.post(
                    "/files/upload",
                    headers={"Authorization": f"Bearer {token}"},
                    files={"file": ("hello.txt", b"hi", "text/plain")},
                )
            finally:
                app.dependency_overrides.clear()

    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "hello.txt"
    assert body["tg_file_id"] == "BAADBAADrwADBREAAYag"
    assert body["size_bytes"] == 2


@pytest.mark.asyncio
async def test_upload_to_folder_happy_path():
    """Verify uploading a file to an existing folder succeeds without NameError."""
    from app.main import app
    import uuid

    fake_telegram_result = {
        "document": {"file_id": "BAADBAADrwADBREAAYag"},
        "message_id": 42,
    }
    with patch(
        "app.routers.files.telegram.send_document",
        AsyncMock(return_value=fake_telegram_result),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            r = await c.post(
                "/auth/login", json={"username": "admin", "password": "admin"}
            )
            token = r.json()["access_token"]

            from app.core import database as dbmod
            from sqlalchemy.ext.asyncio import (
                AsyncSession,
                async_sessionmaker,
                create_async_engine,
            )
            from sqlalchemy.pool import StaticPool
            from app.models.db import Folder

            test_engine = create_async_engine(
                "sqlite+aiosqlite:///:memory:",
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
            async with test_engine.begin() as conn:
                await conn.run_sync(dbmod.Base.metadata.create_all)
            test_session = async_sessionmaker(
                bind=test_engine, class_=AsyncSession, expire_on_commit=False
            )

            # Pre-populate a folder
            folder_id = uuid.uuid4()
            async with test_session() as s:
                db_folder = Folder(id=folder_id, name="Test Folder", user_id="admin")
                s.add(db_folder)
                await s.commit()

            async def override_get_db():
                async with test_session() as s:
                    yield s

            app.dependency_overrides[dbmod.get_db] = override_get_db
            try:
                r = await c.post(
                    "/files/upload",
                    headers={"Authorization": f"Bearer {token}"},
                    data={"folder_id": str(folder_id)},
                    files={"file": ("hello.txt", b"hi", "text/plain")},
                )
            finally:
                app.dependency_overrides.clear()

    assert r.status_code == 201, r.text
    body = r.json()
    assert body["folder_id"] == str(folder_id)

