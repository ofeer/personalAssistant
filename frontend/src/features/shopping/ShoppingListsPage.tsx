import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Dialog, DialogTitle } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useShoppingLists, useCreateList, useDeleteList } from "./useShoppingLists";

export function ShoppingListsPage() {
  const { data: lists, isLoading } = useShoppingLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newListName.trim()) return;

    try {
      await createList.mutateAsync({ name: newListName.trim() });
      setNewListName("");
      setDialogOpen(false);
      toast("List created");
    } catch {
      toast("Failed to create list", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its items?`)) return;
    try {
      await deleteList.mutateAsync(id);
      toast("List deleted");
    } catch {
      toast("Failed to delete list", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shopping Lists</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={18} />
          New List
        </Button>
      </div>

      {!lists?.length ? (
        <EmptyState
          icon={<ShoppingCart size={48} />}
          title="No shopping lists yet"
          description="Create your first shopping list to get started."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus size={18} />
              Create List
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <Link key={list.id} to={`/shopping/${list.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-semibold">{list.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {list.checked_count}/{list.item_count} items checked
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      {list.item_count === 0
                        ? "Empty"
                        : list.checked_count === list.item_count
                          ? "Done"
                          : `${(list.item_count ?? 0) - (list.checked_count ?? 0)} left`}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.preventDefault();
                        handleDelete(list.id, list.name);
                      }}
                    >
                      <Trash2 size={16} className="text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>New Shopping List</DialogTitle>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <Input
            placeholder="List name..."
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createList.isPending}>
              {createList.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
