from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)


class ChatAction(BaseModel):
    tool_name: str
    params: dict
    result: dict | None = None
    success: bool = True
    error: str | None = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    actions: list[ChatAction] | None = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
