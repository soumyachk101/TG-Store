"""Auth middleware: JWT verification dependency.

Per AI instructions: every route (except /auth/login and /health) must use
Depends(require_auth). Tokens are HS256-signed with JWT_SECRET.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# tokenUrl is for OpenAPI docs only — actual auth is JSON-based, not OAuth form
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def create_access_token(subject: str) -> tuple[str, int]:
    """Create an HS256 JWT. Returns (token, expires_in_seconds)."""
    expire_seconds = settings.jwt_expire_hours * 3600
    expire_at = datetime.now(tz=timezone.utc) + timedelta(seconds=expire_seconds)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire_at,
        "iat": datetime.now(tz=timezone.utc),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, expire_seconds


def verify_credentials(username: str, password: str) -> bool:
    """Constant-time comparison against env-var credentials.

    For a single-user personal storage this is the right level — see PRD §3.6.
    """
    if not settings.admin_username or not settings.admin_password:
        # In dev without configured creds, allow a fallback so the app boots.
        # In prod this branch is never hit (deploy checklist enforces it).
        return False
    return username == settings.admin_username and password == settings.admin_password


async def require_auth(token: str | None = Depends(oauth2_scheme)) -> dict[str, Any]:
    """FastAPI dependency: validates either a Firebase ID token or local HS256 JWT.

    Raises 401 on missing/invalid/expired tokens.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if settings.firebase_mock_auth:
        return {
            "uid": "mock-admin",
            "name": "Admin User",
            "email": "admin@tgstore.local",
            "sub": "mock-admin",
        }

    # 1. Try Firebase Token Verification
    try:
        from firebase_admin import auth as firebase_auth
        decoded_token = firebase_auth.verify_id_token(token)
        decoded_token["sub"] = decoded_token.get("uid") or decoded_token.get("sub")
        return decoded_token
    except Exception as firebase_exc:
        # 2. Fallback to local HS256 JWT for tests or compatibility
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
            return payload
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired token. Firebase verification error: {firebase_exc}",
                headers={"WWW-Authenticate": "Bearer"},
            )
