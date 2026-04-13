from fastapi import HTTPException, status

from app.db.client import get_supabase
from app.models.shopping import (
    ReorderPayload,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingListCreate,
    ShoppingListUpdate,
)


class ShoppingService:
    def __init__(self) -> None:
        self._db = get_supabase()

    async def get_lists(self, user_id: str) -> list[dict]:
        result = (
            self._db.table("shopping_lists")
            .select("*, shopping_items(id, is_checked)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        lists = []
        for row in result.data:
            items = row.pop("shopping_items", [])
            row["item_count"] = len(items)
            row["checked_count"] = sum(1 for item in items if item["is_checked"])
            lists.append(row)
        return lists

    async def get_list(self, list_id: str, user_id: str) -> dict:
        result = (
            self._db.table("shopping_lists")
            .select("*, shopping_items(*)")
            .eq("id", list_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shopping list not found",
            )
        row = result.data
        row["items"] = sorted(
            row.pop("shopping_items", []),
            key=lambda item: (item["is_checked"], item["sort_order"]),
        )
        return row

    async def create_list(self, user_id: str, payload: ShoppingListCreate) -> dict:
        result = (
            self._db.table("shopping_lists")
            .insert({"user_id": user_id, "name": payload.name})
            .execute()
        )
        return result.data[0]

    async def update_list(
        self, list_id: str, user_id: str, payload: ShoppingListUpdate
    ) -> dict:
        await self._verify_list_ownership(list_id, user_id)
        result = (
            self._db.table("shopping_lists")
            .update({"name": payload.name})
            .eq("id", list_id)
            .execute()
        )
        return result.data[0]

    async def delete_list(self, list_id: str, user_id: str) -> None:
        await self._verify_list_ownership(list_id, user_id)
        self._db.table("shopping_lists").delete().eq("id", list_id).execute()

    async def add_item(
        self, list_id: str, user_id: str, payload: ShoppingItemCreate
    ) -> dict:
        await self._verify_list_ownership(list_id, user_id)
        data = {"list_id": list_id, **payload.model_dump(exclude_none=True)}
        result = self._db.table("shopping_items").insert(data).execute()
        return result.data[0]

    async def update_item(
        self, item_id: str, user_id: str, payload: ShoppingItemUpdate
    ) -> dict:
        await self._verify_item_ownership(item_id, user_id)
        update_data = payload.model_dump(exclude_none=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )
        result = (
            self._db.table("shopping_items")
            .update(update_data)
            .eq("id", item_id)
            .execute()
        )
        return result.data[0]

    async def delete_item(self, item_id: str, user_id: str) -> None:
        await self._verify_item_ownership(item_id, user_id)
        self._db.table("shopping_items").delete().eq("id", item_id).execute()

    async def reorder_items(
        self, list_id: str, user_id: str, payload: ReorderPayload
    ) -> None:
        await self._verify_list_ownership(list_id, user_id)

        item_ids = [entry.id for entry in payload.items]
        result = (
            self._db.table("shopping_items")
            .select("id")
            .eq("list_id", list_id)
            .in_("id", item_ids)
            .execute()
        )
        found_ids = {row["id"] for row in result.data}
        missing = set(item_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Items not found in this list: {', '.join(missing)}",
            )

        for entry in payload.items:
            update_data = {
                "sort_order": entry.sort_order,
                "category": entry.category,
            }
            (
                self._db.table("shopping_items")
                .update(update_data)
                .eq("id", entry.id)
                .execute()
            )

    async def check_all_items(
        self, list_id: str, user_id: str, is_checked: bool
    ) -> None:
        await self._verify_list_ownership(list_id, user_id)
        (
            self._db.table("shopping_items")
            .update({"is_checked": is_checked})
            .eq("list_id", list_id)
            .execute()
        )

    async def _verify_list_ownership(self, list_id: str, user_id: str) -> None:
        result = (
            self._db.table("shopping_lists")
            .select("id")
            .eq("id", list_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shopping list not found",
            )

    async def _verify_item_ownership(self, item_id: str, user_id: str) -> None:
        result = (
            self._db.table("shopping_items")
            .select("id, list_id, shopping_lists!inner(user_id)")
            .eq("id", item_id)
            .eq("shopping_lists.user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shopping item not found",
            )
