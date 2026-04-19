from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ShoppingListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class ShoppingListUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class ShoppingItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(default=1, gt=0)
    unit: str | None = None
    category: str | None = None


class ShoppingItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    amount: float | None = Field(default=None, gt=0)
    unit: str | None = None
    category: str | None = None
    is_checked: bool | None = None
    sort_order: int | None = None


class ShoppingItemResponse(BaseModel):
    id: str
    list_id: str
    name: str
    amount: float
    unit: str | None
    category: str | None
    is_checked: bool
    sort_order: int
    created_at: datetime


class ShoppingListResponse(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime
    updated_at: datetime
    item_count: int = 0
    checked_count: int = 0


class ShoppingListDetailResponse(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime
    updated_at: datetime
    items: list[ShoppingItemResponse] = []


class ReorderItem(BaseModel):
    id: str
    sort_order: int = Field(..., ge=0)
    category: str | None = None


class ReorderPayload(BaseModel):
    items: list[ReorderItem] = Field(..., min_length=1)
