"""Auth router: login + me."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.middleware.auth import create_access_token, require_auth, verify_credentials
from app.models.schemas import LoginRequest, LoginResponse, UserInfo

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    """Validate username/password, return a JWT."""
    if not verify_credentials(payload.username, payload.password):
        # Generic message — do not leak which field was wrong
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token, expires_in = create_access_token(subject=payload.username)
    return LoginResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserInfo)
async def me(claims: dict = Depends(require_auth)) -> UserInfo:
    """Return the current user (extracted from the verified JWT)."""
    return UserInfo(username=claims.get("sub", ""))
