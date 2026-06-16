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

# tokenUrl is for OpenAPI docs only — actual auth is JSON-based, not OAuth form.
# Tokens are accepted ONLY via the Authorization header. We deliberately do NOT
# accept `?token=...` query strings: query parameters leak into server access
# logs, browser history, and HTTP Referer headers, and the 24-hour token
# lifetime is too long to accept that exposure.
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


import secrets


def verify_credentials(username: str, password: str) -> bool:
    """Constant-time comparison against env-var credentials.

    For a single-user personal storage this is the right level — see PRD §3.6.
    """
    if not settings.admin_username or not settings.admin_password:
        # In dev without configured creds, allow a fallback so the app boots.
        # In prod this branch is never hit (deploy checklist enforces it).
        return False
    return secrets.compare_digest(username, settings.admin_username) and secrets.compare_digest(password, settings.admin_password)


import urllib.request
import json
import time

_google_certs_cache: dict[str, str] = {}
_google_certs_expires_at: float = 0.0

def fetch_google_certs() -> dict[str, str]:
    global _google_certs_cache, _google_certs_expires_at
    now = time.time()
    if not _google_certs_cache or now > _google_certs_expires_at:
        try:
            certs_url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
            with urllib.request.urlopen(certs_url, timeout=5) as response:
                _google_certs_cache = json.loads(response.read().decode())
                _google_certs_expires_at = now + 3600
        except Exception as e:
            if not _google_certs_cache:
                raise e
    return _google_certs_cache


def verify_firebase_token_manually(token: str) -> dict[str, Any]:
    """Verify Firebase ID token manually using Google's public certificates."""
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("No kid found in token header")

    certs = fetch_google_certs()
    if kid not in certs:
        raise ValueError("Token kid not found in Google's certificates")

    cert = certs[kid]
    unverified_claims = jwt.get_unverified_claims(token)
    aud = unverified_claims.get("aud")
    if not aud:
        raise ValueError("No audience (aud) found in token claims")

    if settings.firebase_project_id and aud != settings.firebase_project_id:
        raise ValueError(
            f"Token audience '{aud}' does not match configured Firebase project ID '{settings.firebase_project_id}'"
        )

    decoded = jwt.decode(
        token,
        cert,
        algorithms=["RS256"],
        audience=aud,
        issuer=f"https://securetoken.google.com/{aud}"
    )
    decoded["sub"] = decoded.get("uid") or decoded.get("sub")
    return decoded


async def require_auth(
    token: str | None = Depends(oauth2_scheme),
) -> dict[str, Any]:
    """FastAPI dependency: validates either a Firebase ID token or local HS256 JWT.

    The token MUST be supplied via the `Authorization: Bearer <token>` header.
    Query-string tokens are intentionally rejected — see the comment on
    `oauth2_scheme` above for the reasoning.
    Raises 401 on missing/invalid/expired tokens.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    actual_token = token

    if settings.firebase_mock_auth:
        if settings.environment == "production":
            # CRIT-3: mock auth must never be reachable on a public deploy.
            # Return 401 rather than 500 to avoid hinting at a misconfig.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mock auth is disabled in production",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {
            "uid": "mock-admin",
            "name": "Admin User",
            "email": "admin@tgstore.local",
            "sub": "mock-admin",
        }

    # Detect token type using algorithm header to avoid unnecessary network queries
    try:
        unverified_header = jwt.get_unverified_header(actual_token)
        alg = unverified_header.get("alg")
    except Exception:
        alg = None

    if alg == "RS256":
        # 1. Try Firebase Token Verification (via Admin SDK)
        try:
            from firebase_admin import auth as firebase_auth
            decoded_token = firebase_auth.verify_id_token(actual_token)
            decoded_token["sub"] = decoded_token.get("uid") or decoded_token.get("sub")
            return decoded_token
        except Exception as firebase_exc:
            # Fallback to manual verification using public keys (useful if SDK is uninitialized)
            try:
                return verify_firebase_token_manually(actual_token)
            except Exception as manual_exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid or expired Firebase token. SDK error: {firebase_exc} (Manual check: {manual_exc})",
                    headers={"WWW-Authenticate": "Bearer"},
                )
    else:
        # Local HS256 JWT path. Used for credentials login / fallback auth.
        # Startup checks verify that settings.jwt_secret is rotated in production.
        try:
            payload = jwt.decode(actual_token, settings.jwt_secret, algorithms=["HS256"])
            return payload
        except Exception as local_exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired local token. Error: {local_exc}",
                headers={"WWW-Authenticate": "Bearer"},
            )

