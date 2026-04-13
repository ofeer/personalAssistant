import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogTitle } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import type { Label } from "@/types/tasks";
import { useLabels, useCreateLabel, useDeleteLabel } from "./useTaskHooks";
import { GROUP_COLORS } from "./constants";

interface LabelManagerProps {
  open: boolean;
  onClose: () => void;
}

export function LabelManager({ open, onClose }: LabelManagerProps) {
  const { data: labels = [] } = useLabels();
  const createLabel = useCreateLabel();
  const deleteLabel = useDeleteLabel();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLORS[0]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createLabel.mutateAsync({ name: name.trim(), color });
      setName("");
      toast("Label created");
    } catch {
      toast("Failed to create label", "error");
    }
  };

  const handleDelete = async (label: Label) => {
    if (!confirm(`Delete label "${label.name}"?`)) return;
    try {
      await deleteLabel.mutateAsync(label.id);
      toast("Label deleted");
    } catch {
      toast("Failed to delete label", "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Manage Labels</DialogTitle>
      <div className="mt-4 space-y-3">
        {labels.map((label) => (
          <div key={label.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="text-sm font-medium">{label.name}</span>
            </div>
            <button
              onClick={() => handleDelete(label)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {labels.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No labels yet. Create one below.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Label name..."
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") handleCreate(); }}
            className="h-8 text-sm"
          />
          <div className="flex gap-1">
            {GROUP_COLORS.map((clr) => (
              <button
                key={clr}
                className="h-8 w-8 shrink-0 rounded-md border-2 transition-transform"
                style={{
                  backgroundColor: clr,
                  borderColor: clr === color ? "var(--color-foreground)" : "transparent",
                  transform: clr === color ? "scale(1.1)" : "scale(1)",
                }}
                onClick={() => setColor(clr)}
              />
            ))}
          </div>
          <Button size="sm" onClick={handleCreate} disabled={createLabel.isPending}>
            <Plus size={14} />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
