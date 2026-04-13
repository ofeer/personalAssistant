import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.chat import router as chat_router
from app.api.v1.routes.shopping import router as shopping_router
from app.api.v1.routes.tasks import router as tasks_router
from app.core.config import settings
from app.core.security import load_jwks
from app.db.client import get_supabase

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        get_supabase()
        logger.info("Supabase client initialized successfully")
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", exc)
        raise
    try:
        load_jwks()
    except Exception as exc:
        logger.error("Failed to load JWKS keys: %s", exc)
        raise
    yield


app = FastAPI(title="Personal App API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(shopping_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
