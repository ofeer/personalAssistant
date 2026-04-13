export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
  checked_count?: number;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  amount: number;
  unit: string | null;
  category: string | null;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateShoppingListPayload {
  name: string;
}

export interface CreateShoppingItemPayload {
  name: string;
  amount?: number;
  unit?: string;
  category?: string;
}

export interface UpdateShoppingItemPayload {
  name?: string;
  amount?: number;
  unit?: string;
  category?: string;
  is_checked?: boolean;
  sort_order?: number;
}

export interface ReorderItemEntry {
  id: string;
  sort_order: number;
  category?: string | null;
}
