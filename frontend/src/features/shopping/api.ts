import { api } from "@/lib/api";
import type {
  CreateShoppingItemPayload,
  CreateShoppingListPayload,
  ReorderItemEntry,
  ShoppingItem,
  ShoppingList,
  UpdateShoppingItemPayload,
} from "@/types/shopping";

interface ShoppingListDetail extends Omit<ShoppingList, "item_count" | "checked_count"> {
  items: ShoppingItem[];
}

export const shoppingApi = {
  getLists: () =>
    api.get<ShoppingList[]>("/shopping-lists").then((res) => res.data),

  getList: (id: string) =>
    api.get<ShoppingListDetail>(`/shopping-lists/${id}`).then((res) => res.data),

  createList: (payload: CreateShoppingListPayload) =>
    api.post<ShoppingList>("/shopping-lists", payload).then((res) => res.data),

  updateList: (id: string, payload: CreateShoppingListPayload) =>
    api
      .patch<ShoppingList>(`/shopping-lists/${id}`, payload)
      .then((res) => res.data),

  deleteList: (id: string) => api.delete(`/shopping-lists/${id}`),

  addItem: (listId: string, payload: CreateShoppingItemPayload) =>
    api
      .post<ShoppingItem>(`/shopping-lists/${listId}/items`, payload)
      .then((res) => res.data),

  updateItem: (itemId: string, payload: UpdateShoppingItemPayload) =>
    api
      .patch<ShoppingItem>(`/shopping-lists/items/${itemId}`, payload)
      .then((res) => res.data),

  deleteItem: (itemId: string) =>
    api.delete(`/shopping-lists/items/${itemId}`),

  reorderItems: (listId: string, items: ReorderItemEntry[]) =>
    api.put(`/shopping-lists/${listId}/reorder`, { items }),

  checkAll: (listId: string, isChecked: boolean) =>
    api.patch(`/shopping-lists/${listId}/check-all`, null, {
      params: { is_checked: isChecked },
    }),
};
