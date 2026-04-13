import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogTitle } from "@/components/ui/Dialog";
import type { TaskGroup, CreateTaskPayload } from "@/types/tasks";
import {
  PRIORITY_LABELS,
  STATUS_OPTIONS,
  STATUS_LABELS,
  RECURRENCE_OPTIONS,
} from "./constants";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTaskPayload) => void;
  groups: TaskGroup[];
  parentTaskId?: string;
  isSubmitting?: boolean;
}

export function TaskForm({
  open,
  onClose,
  onSubmit,
  groups,
  parentTaskId,
  isSubmitting,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [groupId, setGroupId] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    const payload: CreateTaskPayload = {
      title: title.trim(),
      priority,
      status,
    };
    if (description.trim()) payload.description = description.trim();
    if (dueDate) payload.due_date = dueDate;
    if (dueTime) payload.due_time = dueTime;
    if (recurrence) payload.recurrence = recurrence;
    if (groupId) payload.group_id = groupId;
    if (parentTaskId) payload.parent_task_id = parentTaskId;

    onSubmit(payload);
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority(0);
    setStatus("todo");
    setDueDate("");
    setDueTime("");
    setRecurrence("");
    setGroupId("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{parentTaskId ? "Add Subtask" : "New Task"}</DialogTitle>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="task-title" className="text-sm font-medium">Title</label>
          <Input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to be done?"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="task-desc" className="text-sm font-medium">Description</label>
          <textarea
            id="task-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional details..."
            rows={2}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="task-priority" className="text-sm font-medium">Priority</label>
            <Select
              id="task-priority"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            >
              {PRIORITY_LABELS.map((label, index) => (
                <option key={index} value={index}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="task-status" className="text-sm font-medium">Status</label>
            <Select
              id="task-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {STATUS_LABELS[opt]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="task-due-date" className="text-sm font-medium">Due Date</label>
            <DateQuickPicks value={dueDate} onChange={setDueDate} />
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="task-due-time" className="text-sm font-medium">Due Time</label>
            <Input
              id="task-due-time"
              type="time"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="task-recurrence" className="text-sm font-medium">Repeat</label>
            <Select
              id="task-recurrence"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {!parentTaskId && groups.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="task-group" className="text-sm font-medium">Group</label>
              <Select
                id="task-group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
              >
                <option value="">None</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function getQuickPickDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return [
    { label: "Today", value: fmt(today) },
    { label: "Tomorrow", value: fmt(tomorrow) },
    { label: "Next Week", value: fmt(nextWeek) },
  ];
}

function DateQuickPicks({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const picks = getQuickPickDates();
  return (
    <div className="flex gap-1.5">
      {picks.map((pick) => (
        <button
          key={pick.label}
          type="button"
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            value === pick.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => onChange(pick.value)}
        >
          {pick.label}
        </button>
      ))}
    </div>
  );
}
