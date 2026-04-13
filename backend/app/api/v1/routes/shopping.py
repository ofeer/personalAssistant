from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.shopping import (
    ReorderPayload,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingItemResponse,
    ShoppingListCreate,
    ShoppingListDetailResponse,
    ShoppingListResponse,
    ShoppingListUpdate,
)
from app.services.shopping import ShoppingService

router = APIRouter(prefix="/shopping-lists", tags=["shopping"])


def _get_service() -> ShoppingService:
    return ShoppingService()


@router.get("", response_model=list[ShoppingListResponse])
async def get_lists(
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    return await service.get_lists(user_id)


@router.post("", response_model=ShoppingListResponse, status_code=201)
async def create_list(
    payload: ShoppingListCreate,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    return await service.create_list(user_id, payload)


@router.get("/{list_id}", response_model=ShoppingListDetailResponse)
async def get_list(
    list_id: str,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    return await service.get_list(list_id, user_id)


@router.patch("/{list_id}", response_model=ShoppingListResponse)
async def update_list(
    list_id: str,
    payload: ShoppingListUpdate,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    return await service.update_list(list_id, user_id, payload)


@router.delete("/{list_id}", status_code=204)
async def delete_list(
    list_id: str,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    await service.delete_list(list_id, user_id)


@router.post(
    "/{list_id}/items", response_model=ShoppingItemResponse, status_code=201
)
async def add_item(
    list_id: str,
    payload: ShoppingItemCreate,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    return await service.add_item(list_id, user_id, payload)


@router.patch("/items/{item_id}", response_model=ShoppingItemResponse)
async def update_item(
    item_id: str,
    payload: ShoppingItemUpdate,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    return await service.update_item(item_id, user_id, payload)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: str,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    await service.delete_item(item_id, user_id)


@router.put("/{list_id}/reorder", status_code=204)
async def reorder_items(
    list_id: str,
    payload: ReorderPayload,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    await service.reorder_items(list_id, user_id, payload)


@router.patch("/{list_id}/check-all", status_code=204)
async def check_all_items(
    list_id: str,
    is_checked: bool = True,
    user_id: str = Depends(get_current_user),
    service: ShoppingService = Depends(_get_service),
):
    await service.check_all_items(list_id, user_id, is_checked)
