import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCheck,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { ShoppingItem, ReorderItemEntry } from "@/types/shopping";
import { CATEGORY_OPTIONS, UNIT_OPTIONS } from "./constants";
import {
  useShoppingList,
  useAddItem,
  useUpdateItem,
  useDeleteItem,
  useCheckAllItems,
  useDeleteList,
  useReorderItems,
} from "./useShoppingLists";

const SORT_ORDER_GAP = 1000;

export function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: list, isLoading } = useShoppingList(id!);
  const addItem = useAddItem(id!);
  const updateItem = useUpdateItem(id!);
  const deleteItem = useDeleteItem(id!);
  const checkAll = useCheckAllItems(id!);
  const deleteList = useDeleteList();
  const reorderItems = useReorderItems(id!);

  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const uncheckedItems = useMemo(
    () => list?.items.filter((item) => !item.is_checked) ?? [],
    [list?.items],
  );
  const checkedItems = useMemo(
    () => list?.items.filter((item) => item.is_checked) ?? [],
    [list?.items],
  );
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of uncheckedItems) {
      const key = item.category || "Uncategorized";
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return groups;
  }, [uncheckedItems]);
  const uncheckedIds = useMemo(
    () => uncheckedItems.map((item) => item.id),
    [uncheckedItems],
  );
  const activeItem = activeId
    ? uncheckedItems.find((item) => item.id === activeId)
    : undefined;

  const allChecked =
    list?.items &&
    list.items.length > 0 &&
    list.items.every((item) => item.is_checked);

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!newItemName.trim()) return;
    try {
      await addItem.mutateAsync({
        name: newItemName.trim(),
        amount: parseFloat(newItemAmount) || 1,
        ...(newItemUnit && { unit: newItemUnit }),
        ...(newItemCategory && { category: newItemCategory }),
      });
      setNewItemName("");
      setNewItemAmount("1");
      setNewItemUnit("");
      setNewItemCategory("");
    } catch {
      toast("Failed to add item", "error");
    }
  };

  const handleToggleCheck = async (
    itemId: string,
    currentlyChecked: boolean,
  ) => {
    try {
      await updateItem.mutateAsync({
        itemId,
        payload: { is_checked: !currentlyChecked },
      });
    } catch {
      toast("Failed to update item", "error");
    }
  };

  const handleUpdateAmountUnit = async (
    itemId: string,
    amount: number,
    unit: string | null,
  ) => {
    try {
      await updateItem.mutateAsync({
        itemId,
        payload: { amount, unit: unit ?? undefined },
      });
    } catch {
      toast("Failed to update item", "error");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem.mutateAsync(itemId);
    } catch {
      toast("Failed to delete item", "error");
    }
  };

  const handleDeleteList = async () => {
    if (!list || !confirm(`Delete "${list.name}" and all its items?`)) return;
    try {
      await deleteList.mutateAsync(id!);
      navigate("/shopping");
      toast("List deleted");
    } catch {
      toast("Failed to delete list", "error");
    }
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = uncheckedItems.findIndex(
        (item) => item.id === active.id,
      );
      const newIndex = uncheckedItems.findIndex(
        (item) => item.id === over.id,
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(uncheckedItems, oldIndex, newIndex);

      let newCategory: string | null;
      if (newIndex > 0) {
        newCategory = newOrder[newIndex - 1].category;
      } else if (newOrder.length > 1) {
        newCategory = newOrder[1].category;
      } else {
        newCategory = uncheckedItems[oldIndex].category;
      }

      const changes: ReorderItemEntry[] = [];
      for (let idx = 0; idx < newOrder.length; idx++) {
        const item = newOrder[idx];
        const newSortOrder = idx * SORT_ORDER_GAP;
        const itemCategory =
          item.id === (active.id as string) ? newCategory : item.category;

        if (
          item.sort_order !== newSortOrder ||
          item.category !== itemCategory
        ) {
          changes.push({
            id: item.id,
            sort_order: newSortOrder,
            category: itemCategory,
          });
        }
      }

      if (changes.length > 0) {
        reorderItems.mutate(changes, {
          onError: () => toast("Failed to reorder items", "error"),
        });
      }
    },
    [uncheckedItems, reorderItems, toast],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!list) {
    return (
      <EmptyState
        icon={<X size={48} />}
        title="List not found"
        description="This shopping list doesn't exist or was deleted."
        action={
          <Link to="/shopping">
            <Button variant="outline">Back to lists</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/shopping">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{list.name}</h1>
        </div>
        <div className="flex gap-2">
          {list.items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkAll.mutate(!allChecked)}
            >
              <CheckCheck size={16} />
              {allChecked ? "Uncheck all" : "Check all"}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={handleDeleteList}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleAddItem}
        className="mb-6 rounded-lg border border-border bg-card p-3"
      >
        <div className="flex gap-2">
          <Input
            placeholder="Add item..."
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            min="0.1"
            step="0.1"
            value={newItemAmount}
            onChange={(event) => setNewItemAmount(event.target.value)}
            className="w-20"
          />
          <Button type="submit" size="icon" disabled={addItem.isPending}>
            <Plus size={18} />
          </Button>
        </div>
        <div className="mt-2 flex gap-2">
          <Select
            value={newItemCategory}
            onChange={(event) => setNewItemCategory(event.target.value)}
            className="flex-1"
          >
            <option value="">Category (optional)</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
          <Select
            value={newItemUnit}
            onChange={(event) => setNewItemUnit(event.target.value)}
            className="w-28"
          >
            <option value="">Unit</option>
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </div>
      </form>

      {list.items.length === 0 ? (
        <EmptyState
          icon={<Plus size={48} />}
          title="List is empty"
          description="Add items using the form above."
        />
      ) : (
        <div className="space-y-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={uncheckedIds}
              strategy={verticalListSortingStrategy}
            >
              {[...categoryGroups.entries()].map(([category, items]) => (
                <div key={category}>
                  <div className="py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <SortableItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleCheck(item.id, false)}
                        onDelete={() => handleDeleteItem(item.id)}
                        onUpdateAmountUnit={(amount, unit) =>
                          handleUpdateAmountUnit(item.id, amount, unit)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 shadow-lg">
                  <GripVertical size={16} className="text-muted-foreground" />
                  <span className="flex-1 text-sm">{activeItem.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {activeItem.amount}
                    {activeItem.unit ? ` ${activeItem.unit}` : ""}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {checkedItems.length > 0 && uncheckedItems.length > 0 && (
            <div className="py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Checked ({checkedItems.length})
            </div>
          )}

          {checkedItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              checked
              onToggle={() => handleToggleCheck(item.id, true)}
              onDelete={() => handleDeleteItem(item.id)}
              onUpdateAmountUnit={(amount, unit) =>
                handleUpdateAmountUnit(item.id, amount, unit)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SortableItemRow({
  item,
  onToggle,
  onDelete,
  onUpdateAmountUnit,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateAmountUnit: (amount: number, unit: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <input
          type="checkbox"
          checked={false}
          onChange={onToggle}
          className="h-4 w-4 rounded accent-primary"
        />
        <span className="flex-1 text-sm">{item.name}</span>
        <EditableAmountUnit item={item} onSave={onUpdateAmountUnit} />
        <button
          type="button"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  checked = false,
  onToggle,
  onDelete,
  onUpdateAmountUnit,
}: {
  item: ShoppingItem;
  checked?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateAmountUnit: (amount: number, unit: string | null) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5",
        checked && "opacity-60",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded accent-primary"
      />
      <span className={cn("flex-1 text-sm", checked && "line-through")}>
        {item.name}
      </span>
      <EditableAmountUnit item={item} checked={checked} onSave={onUpdateAmountUnit} />
      <button
        type="button"
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function EditableAmountUnit({
  item,
  checked = false,
  onSave,
}: {
  item: ShoppingItem;
  checked?: boolean;
  onSave: (amount: number, unit: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setEditAmount(String(item.amount));
    setEditUnit(item.unit ?? "");
    setEditing(true);
    requestAnimationFrame(() => amountRef.current?.select());
  };

  const save = () => {
    const parsed = parseFloat(editAmount);
    if (!parsed || parsed <= 0) {
      setEditing(false);
      return;
    }
    const newUnit = editUnit || null;
    if (parsed !== item.amount || newUnit !== item.unit) {
      onSave(parsed, newUnit);
    }
    setEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          save();
        }
      }}>
        <input
          ref={amountRef}
          type="number"
          min="0.1"
          step="0.1"
          value={editAmount}
          onChange={(event) => setEditAmount(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-16 rounded border border-border bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <select
          value={editUnit}
          onChange={(event) => setEditUnit(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 rounded border border-border bg-background px-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">--</option>
          {UNIT_OPTIONS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        "rounded px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
        checked && "line-through",
      )}
      title="Click to edit amount and unit"
    >
      {item.amount}
      {item.unit ? ` ${item.unit}` : ""}
    </button>
  );
}
