import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from openai import APIConnectionError, RateLimitError, APIStatusError

from app.core.security import get_current_user
from app.models.chat import ChatHistoryResponse, ChatMessageRequest, ChatMessageResponse
from app.services.chat import ChatService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


def get_chat_service() -> ChatService:
    return ChatService()


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    body: ChatMessageRequest,
    user_id: str = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
):
    try:
        return await service.send_message(user_id, body.message)
    except APIConnectionError:
        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily unavailable. Please try again.",
        )
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="AI service is busy. Please try again in a moment.",
        )
    except APIStatusError:
        raise HTTPException(
            status_code=502,
            detail="AI service encountered an error. Please try again.",
        )
    except Exception as exc:
        logger.error("Unexpected error in chat", {"error": str(exc)})
        raise HTTPException(
            status_code=500,
            detail="Something went wrong. Please try again or rephrase your message.",
        )


@router.get("/history", response_model=ChatHistoryResponse)
async def get_history(
    limit: int = Query(default=50, ge=1, le=200),
    user_id: str = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
):
    messages = await service.get_history(user_id, limit)
    return ChatHistoryResponse(messages=messages)


@router.delete("/history")
async def clear_history(
    user_id: str = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
):
    await service.clear_history(user_id)
    return {"status": "ok"}
