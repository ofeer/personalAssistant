import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { shoppingApi } from "./api";
import type {
  CreateShoppingItemPayload,
  CreateShoppingListPayload,
  ReorderItemEntry,
  UpdateShoppingItemPayload,
} from "@/types/shopping";

const LISTS_KEY = ["shopping-lists"];
const listDetailKey = (id: string) => ["shopping-lists", id];

export function useShoppingLists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: LISTS_KEY,
    queryFn: shoppingApi.getLists,
    enabled: !!user,
  });
}

export function useShoppingList(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: listDetailKey(id),
    queryFn: () => shoppingApi.getList(id),
    enabled: !!id && !!user,
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateShoppingListPayload) =>
      shoppingApi.createList(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LISTS_KEY }),
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shoppingApi.deleteList(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LISTS_KEY }),
  });
}

export function useAddItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateShoppingItemPayload) =>
      shoppingApi.addItem(listId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDetailKey(listId) });
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
    },
  });
}

export function useUpdateItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: UpdateShoppingItemPayload;
    }) => shoppingApi.updateItem(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDetailKey(listId) });
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
    },
  });
}

export function useDeleteItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => shoppingApi.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDetailKey(listId) });
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
    },
  });
}

export function useReorderItems(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: ReorderItemEntry[]) =>
      shoppingApi.reorderItems(listId, items),

    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: listDetailKey(listId) });

      const previousData = queryClient.getQueryData(listDetailKey(listId));

      queryClient.setQueryData(
        listDetailKey(listId),
        (old: { items: Array<{ id: string; sort_order: number; category: string | null; is_checked: boolean }> } | undefined) => {
          if (!old) return old;
          const updates = new Map(items.map((entry) => [entry.id, entry]));
          return {
            ...old,
            items: old.items
              .map((item) => {
                const update = updates.get(item.id);
                if (!update) return item;
                return {
                  ...item,
                  sort_order: update.sort_order,
                  ...(update.category !== undefined && {
                    category: update.category,
                  }),
                };
              })
              .sort(
                (a, b) =>
                  Number(a.is_checked) - Number(b.is_checked) ||
                  a.sort_order - b.sort_order,
              ),
          };
        },
      );

      return { previousData };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(listDetailKey(listId), context.previousData);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listDetailKey(listId) });
    },
  });
}

export function useCheckAllItems(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isChecked: boolean) => shoppingApi.checkAll(listId, isChecked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listDetailKey(listId) });
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
    },
  });
}
