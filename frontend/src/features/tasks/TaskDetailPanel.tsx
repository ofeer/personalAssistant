import { useState, useCallback } from "react";
import { Calendar, Clock, Repeat, Trash2, Plus, Bell, X, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlideOver } from "@/components/ui/SlideOver";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { TaskDetail, TaskGroup, CreateTaskPayload } from "@/types/tasks";
import {
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
  useCreateTask,
  useCreateReminder,
  useDeleteReminder,
  useReorderTasks,
  useLabels,
  useAssignLabel,
  useUnassignLabel,
} from "./useTaskHooks";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { PRIORITY_LABELS, STATUS_OPTIONS, STATUS_LABELS, RECURRENCE_OPTIONS } from "./constants";

interface TaskDetailPanelProps {
  task: TaskDetail | null;
  groups: TaskGroup[];
  open: boolean;
  onClose: () => void;
}

export function TaskDetailPanel({
  task,
  groups,
  open,
  onClose,
}: TaskDetailPanelProps) {
  const { toast } = useToast();
  const updateTask = useUpdateTask(task?.id ?? "");
  const deleteTask = useDeleteTask();
  const toggleStatus = useUpdateTaskStatus();
  const createSubtask = useCreateTask();
  const createReminder = useCreateReminder(task?.id ?? "");
  const deleteReminder = useDeleteReminder(task?.id ?? "");
  const reorderTasks = useReorderTasks();
  const { data: allLabels = [] } = useLabels();
  const assignLabel = useAssignLabel(task?.id ?? "");
  const unassignLabel = useUnassignLabel(task?.id ?? "");

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [editStatus, setEditStatus] = useState("todo");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDueTime, setEditDueTime] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("");
  const [editGroupId, setEditGroupId] = useState("");

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [reminderDateTime, setReminderDateTime] = useState("");

  if (!task) return null;

  const startEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDueDate(task.due_date ?? "");
    setEditDueTime(task.due_time ?? "");
    setEditRecurrence(task.recurrence ?? "");
    setEditGroupId(task.group_id ?? "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateTask.mutateAsync({
        title: editTitle,
        description: editDescription || undefined,
        priority: editPriority,
        status: editStatus,
        due_date: editDueDate || undefined,
        due_time: editDueTime || undefined,
        recurrence: editRecurrence || undefined,
        group_id: editGroupId || undefined,
      });
      setIsEditing(false);
      toast("Task updated");
    } catch {
      toast("Failed to update task", "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask.mutateAsync(task.id);
      onClose();
      toast("Task deleted");
    } catch {
      toast("Failed to delete task", "error");
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    try {
      await toggleStatus.mutateAsync({ id: subtaskId, status: newStatus });
    } catch {
      toast("Failed to update subtask", "error");
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const payload: CreateTaskPayload = {
      title: newSubtaskTitle.trim(),
      parent_task_id: task.id,
    };
    try {
      await createSubtask.mutateAsync(payload);
      setNewSubtaskTitle("");
    } catch {
      toast("Failed to add subtask", "error");
    }
  };

  const handleAddReminder = async () => {
    if (!reminderDateTime) return;
    try {
      await createReminder.mutateAsync({
        remind_at: new Date(reminderDateTime).toISOString(),
      });
      setReminderDateTime("");
      toast("Reminder added");
    } catch {
      toast("Failed to add reminder", "error");
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await deleteReminder.mutateAsync(reminderId);
    } catch {
      toast("Failed to delete reminder", "error");
    }
  };

  return (
    <SlideOver open={open} onClose={onClose} title="Task Details">
      {isEditing ? (
        <div className="space-y-4">
          <Input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="Task title"
          />
          <textarea
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            placeholder="Description..."
            rows={3}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={editPriority}
              onChange={(event) => setEditPriority(Number(event.target.value))}
            >
              {PRIORITY_LABELS.map((label, index) => (
                <option key={index} value={index}>{label}</option>
              ))}
            </Select>
            <Select
              value={editStatus}
              onChange={(event) => setEditStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{STATUS_LABELS[opt]}</option>
              ))}
            </Select>
          </div>
          <DateQuickPicks value={editDueDate} onChange={setEditDueDate} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
            <Input type="time" value={editDueTime} onChange={(event) => setEditDueTime(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={editRecurrence} onChange={(event) => setEditRecurrence(event.target.value)}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            {groups.length > 0 && (
              <Select value={editGroupId} onChange={(event) => setEditGroupId(event.target.value)}>
                <option value="">No group</option>
                {groups.map((grp) => (
                  <option key={grp.id} value={grp.id}>{grp.name}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updateTask.isPending}>
              {updateTask.isPending ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-xl font-semibold">{task.title}</h3>
            {task.description && (
              <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.group && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: task.group.color + "20", color: task.group.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.group.color }} />
                {task.group.name}
              </span>
            )}
          </div>

          {/* Labels */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Labels</h4>
            <div className="flex flex-wrap gap-1.5">
              {task.labels?.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ backgroundColor: label.color + "25", color: label.color }}
                  onClick={() => unassignLabel.mutate(label.id)}
                  title="Click to remove"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                  {label.name}
                  <X size={10} />
                </span>
              ))}
              {allLabels
                .filter((label) => !task.labels?.some((tl) => tl.id === label.id))
                .map((label) => (
                  <button
                    key={label.id}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                    onClick={() => assignLabel.mutate(label.id)}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            {task.due_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={14} />
                {new Date(task.due_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {task.due_time && (
                  <><Clock size={14} className="ml-2" />{task.due_time}</>
                )}
              </div>
            )}
            {task.recurrence && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Repeat size={14} />
                Repeats {task.recurrence}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 size={14} /> Delete
            </Button>
          </div>

          {/* Subtasks */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">
              Subtasks ({task.subtask_done_count}/{task.subtask_count})
            </h4>
            {task.subtask_count > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${(task.subtask_done_count / task.subtask_count) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round((task.subtask_done_count / task.subtask_count) * 100)}%
                </span>
              </div>
            )}
            <SubtaskDraggableList
              subtasks={task.subtasks}
              onToggleSubtask={handleToggleSubtask}
              onStatusCycle={(subtaskId, newStatus) => {
                toggleStatus.mutate({ id: subtaskId, status: newStatus });
              }}
              onReorder={(items) => reorderTasks.mutate(items)}
            />
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Add subtask..."
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") handleAddSubtask(); }}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAddSubtask} disabled={createSubtask.isPending}>
                <Plus size={14} />
              </Button>
            </div>
          </div>

          {/* Reminders */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">
              <Bell size={14} className="mr-1 inline" />
              Reminders
            </h4>
            <div className="space-y-1">
              {task.reminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
                  <span className={reminder.is_sent ? "text-muted-foreground line-through" : ""}>
                    {new Date(reminder.remind_at).toLocaleString()}
                  </span>
                  <button onClick={() => handleDeleteReminder(reminder.id)} className="text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                type="datetime-local"
                value={reminderDateTime}
                onChange={(event) => setReminderDateTime(event.target.value)}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAddReminder} disabled={createReminder.isPending}>
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

// ── Date quick picks ────────────────────────────────────────

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

// ── Subtask draggable list ──────────────────────────────────

import type { Task } from "@/types/tasks";

function SubtaskDraggableList({
  subtasks,
  onToggleSubtask,
  onStatusCycle,
  onReorder,
}: {
  subtasks: Task[];
  onToggleSubtask: (subtaskId: string, currentStatus: string) => void;
  onStatusCycle: (subtaskId: string, newStatus: string) => void;
  onReorder: (items: { id: string; sort_order: number }[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = subtasks.findIndex((st) => st.id === active.id);
      const newIndex = subtasks.findIndex((st) => st.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(subtasks, oldIndex, newIndex);
      onReorder(reordered.map((st, index) => ({ id: st.id, sort_order: index })));
    },
    [subtasks, onReorder],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={subtasks.map((st) => st.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {subtasks.map((subtask) => (
            <SortableSubtaskRow
              key={subtask.id}
              subtask={subtask}
              onToggle={onToggleSubtask}
              onStatusCycle={onStatusCycle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSubtaskRow({
  subtask,
  onToggle,
  onStatusCycle,
}: {
  subtask: Task;
  onToggle: (subtaskId: string, currentStatus: string) => void;
  onStatusCycle: (subtaskId: string, newStatus: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
    >
      <button
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <input
        type="checkbox"
        checked={subtask.status === "done"}
        onChange={() => onToggle(subtask.id, subtask.status)}
        className="h-3.5 w-3.5 rounded accent-primary"
      />
      <span className={cn("flex-1 text-sm", subtask.status === "done" && "line-through text-muted-foreground")}>
        {subtask.title}
      </span>
      <PriorityBadge priority={subtask.priority} />
      <StatusBadge
        status={subtask.status}
        onClick={(nextStatus) => onStatusCycle(subtask.id, nextStatus)}
      />
    </div>
  );
}
