from __future__ import annotations

import logging

import httpx
import jwt
from jwt.api_jwk import PyJWK
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer()

# Application Security Requirement: JWKS-based JWT verification using Supabase's
# published public keys (ES256). Falls back to HS256 with the shared secret for
# backwards compatibility with older Supabase projects.
_jwks_keys: dict[str, PyJWK] = {}


def load_jwks() -> None:
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    for key_data in response.json()["keys"]:
        kid = key_data.get("kid")
        if kid:
            _jwks_keys[kid] = PyJWK(key_data)
    logger.info("Loaded %d JWKS signing keys from Supabase", len(_jwks_keys))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> str:
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if kid and kid in _jwks_keys:
            payload = jwt.decode(
                token,
                _jwks_keys[kid].key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
            )
        else:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience="authenticated",
            )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )
        return user_id
    except jwt.PyJWTError as exc:
        logger.error('JWT validation failed: %s', exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
