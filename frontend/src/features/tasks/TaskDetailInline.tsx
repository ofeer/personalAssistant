import { useState, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Repeat, Trash2, Plus, Bell, X, GripVertical } from "lucide-react";
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
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Task, TaskDetail, TaskGroup, CreateTaskPayload } from "@/types/tasks";
import {
  useTask,
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

interface TaskDetailInlineProps {
  taskId: string;
  groups: TaskGroup[];
  onClose: () => void;
}

export function TaskDetailInline({ taskId, groups, onClose }: TaskDetailInlineProps) {
  const { data: task } = useTask(taskId);

  if (!task) {
    return (
      <div className="ml-6 mt-1 mb-2 rounded-md border border-border bg-card/50 p-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="ml-6 mt-1 mb-2 overflow-hidden rounded-md border border-border bg-card/50 animate-in slide-in-from-top-1 duration-200">
      <TaskDetailContent task={task} groups={groups} onClose={onClose} />
    </div>
  );
}

function TaskDetailContent({
  task,
  groups,
  onClose,
}: {
  task: TaskDetail;
  groups: TaskGroup[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const updateTask = useUpdateTask(task.id);
  const deleteTask = useDeleteTask();
  const toggleStatus = useUpdateTaskStatus();
  const createSubtask = useCreateTask();
  const createReminder = useCreateReminder(task.id);
  const deleteReminder = useDeleteReminder(task.id);
  const reorderTasks = useReorderTasks();
  const { data: allLabels = [] } = useLabels();
  const assignLabel = useAssignLabel(task.id);
  const unassignLabel = useUnassignLabel(task.id);

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

  const handleAddReminder = async (remindAt: string) => {
    try {
      await createReminder.mutateAsync({ remind_at: remindAt });
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

  const handleStatusChange = async (newStatus: string) => {
    try {
      await toggleStatus.mutateAsync({ id: task.id, status: newStatus });
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const handlePriorityChange = async (newPriority: number) => {
    try {
      await updateTask.mutateAsync({ priority: newPriority });
    } catch {
      toast("Failed to update priority", "error");
    }
  };

  return (
    <div className="p-4">
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
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold">{task.title}</h3>
            {task.description && (
              <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} onClick={handleStatusChange} />
            <PriorityBadge priority={task.priority} onClick={handlePriorityChange} />
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
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Labels</h4>
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
          <div className="space-y-1.5 text-sm">
            {task.due_date ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={14} />
                {new Date(task.due_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {task.due_time && (
                  <><Clock size={14} className="ml-2" />{task.due_time}</>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">No date</span>
                <div className="flex gap-1.5 ml-auto">
                  {getQuickPickDates().map((pick) => (
                    <button
                      key={pick.label}
                      type="button"
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                      onClick={() => updateTask.mutate({ due_date: pick.value })}
                    >
                      {pick.label}
                    </button>
                  ))}
                </div>
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
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subtasks ({task.subtask_done_count}/{task.subtask_count})
            </h4>
            {task.subtask_count > 0 && (
              <div className="mb-2 flex items-center gap-2">
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
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Bell size={12} className="mr-1 inline" />
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
            <ReminderPicker onAdd={handleAddReminder} isAdding={createReminder.isPending} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reminder Picker ─────────────────────────────────────────────

function ReminderPicker({
  onAdd,
  isAdding,
}: {
  onAdd: (remindAt: string) => void;
  isAdding: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const presets = getPresets();

  const handleConfirmCustom = () => {
    if (!selectedDate) return;
    const dt = new Date(selectedDate);
    dt.setHours(selectedHour, selectedMinute, 0, 0);
    onAdd(dt.toISOString());
    setShowCalendar(false);
    setSelectedDate(null);
  };

  const prevMonth = () =>
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () =>
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={isAdding}
            className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors disabled:opacity-50"
            onClick={() => onAdd(preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            showCalendar
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          )}
          onClick={() => setShowCalendar((prev) => !prev)}
        >
          Pick date...
        </button>
      </div>

      {showCalendar && (
        <div className="rounded-md border border-border bg-card p-3 space-y-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium">
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={nextMonth} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day} className="text-[10px] font-medium text-muted-foreground py-1">
                {day}
              </span>
            ))}

            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, index) => (
              <span key={`empty-${index}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const cellDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
              const isPast = cellDate < today;
              const isSelected = selectedDate &&
                cellDate.getFullYear() === selectedDate.getFullYear() &&
                cellDate.getMonth() === selectedDate.getMonth() &&
                cellDate.getDate() === selectedDate.getDate();
              const isToday = cellDate.getTime() === today.getTime();

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  className={cn(
                    "h-7 w-7 mx-auto rounded-full text-xs transition-colors",
                    isPast && "text-muted-foreground/30 cursor-not-allowed",
                    !isPast && !isSelected && "hover:bg-muted",
                    isSelected && "bg-primary text-primary-foreground",
                    isToday && !isSelected && "ring-1 ring-primary",
                  )}
                  onClick={() => setSelectedDate(cellDate)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time selector */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <Clock size={14} className="text-muted-foreground shrink-0" />
            <select
              value={selectedHour}
              onChange={(event) => setSelectedHour(Number(event.target.value))}
              className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Array.from({ length: 24 }).map((_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">:</span>
            <select
              value={selectedMinute}
              onChange={(event) => setSelectedMinute(Number(event.target.value))}
              className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((min) => (
                <option key={min} value={min}>
                  {String(min).padStart(2, "0")}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={handleConfirmCustom}
              disabled={!selectedDate || isAdding}
            >
              Set reminder
            </Button>
          </div>

          {selectedDate && (
            <p className="text-xs text-muted-foreground text-center">
              {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {" at "}
              {String(selectedHour).padStart(2, "0")}:{String(selectedMinute).padStart(2, "0")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getPresets() {
  const now = new Date();

  const in30min = new Date(now.getTime() + 30 * 60 * 1000);
  const in1hour = new Date(now.getTime() + 60 * 60 * 1000);
  const in3hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const tomorrow9am = new Date(now);
  tomorrow9am.setDate(now.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  const nextMonday = new Date(now);
  const daysUntilMon = ((1 - now.getDay() + 7) % 7) || 7;
  nextMonday.setDate(now.getDate() + daysUntilMon);
  nextMonday.setHours(9, 0, 0, 0);

  return [
    { label: "In 30 min", value: in30min.toISOString() },
    { label: "In 1 hour", value: in1hour.toISOString() },
    { label: "In 3 hours", value: in3hours.toISOString() },
    { label: "Tomorrow 9am", value: tomorrow9am.toISOString() },
    { label: "Next Monday 9am", value: nextMonday.toISOString() },
  ];
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
