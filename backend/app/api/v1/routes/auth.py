import logging

from fastapi import APIRouter, HTTPException, status
from supabase_auth import AdminUserAttributes
from pydantic import BaseModel, EmailStr

from app.db.client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterResponse(BaseModel):
    user_id: str
    email: str


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(payload: RegisterRequest):
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )

    supabase = get_supabase()
    try:
        result = supabase.auth.admin.create_user(
            AdminUserAttributes(
                email=payload.email,
                password=payload.password,
                email_confirm=True,
            )
        )
    except Exception as exc:
        logger.error('Failed to create user: %s', exc)
        detail = str(exc)
        if "already been registered" in detail.lower() or "already exists" in detail.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed",
        )

    return RegisterResponse(user_id=result.user.id, email=result.user.email)
