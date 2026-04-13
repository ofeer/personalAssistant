import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task, TaskGroup } from "@/types/tasks";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

interface TaskCardProps {
  task: Task;
  groups?: TaskGroup[];
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onStatusCycle?: (taskId: string, newStatus: string) => void;
  onPriorityChange?: (taskId: string, newPriority: number) => void;
  onDateChange?: (taskId: string, newDate: string) => void;
  onClick: (taskId: string) => void;
  isExpanded?: boolean;
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

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MiniCalendar({ selectedDate, onSelect }: { selectedDate: string | null; onSelect: (date: string) => void }) {
  const initial = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="w-[224px] space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium">
          {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {day}
          </span>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const cellDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
          const cellISO = toISODate(cellDate);
          const isSelected = selectedDate === cellISO;
          const isToday = cellDate.getTime() === today.getTime();

          return (
            <button
              key={day}
              type="button"
              className={cn(
                "h-7 w-7 mx-auto rounded-full text-xs transition-colors",
                !isSelected && "hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground",
                isToday && !isSelected && "ring-1 ring-primary",
              )}
              onClick={() => onSelect(cellISO)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TaskCard({ task, groups, onToggleStatus, onStatusCycle, onPriorityChange, onDateChange, onClick, isExpanded }: TaskCardProps) {
  const isDone = task.status === "done";
  const isOverdue =
    task.due_date && !isDone && new Date(task.due_date) < new Date(new Date().toDateString());
  const group = groups?.find((grp) => grp.id === task.group_id);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateSelect = (newDate: string) => {
    onDateChange?.(task.id, newDate);
    setShowDatePicker(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-shadow hover:shadow-sm",
        isDone && "opacity-60",
        isExpanded && "border-primary/50 shadow-sm",
      )}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => onToggleStatus(task.id, task.status)}
        className="h-4 w-4 shrink-0 rounded accent-primary"
      />

      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onClick(task.id)}
      >
        {group && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: group.color }}
          />
        )}
        <span className={cn("truncate text-sm", isDone && "line-through")}>
          {task.title}
        </span>
        {task.labels?.length > 0 && (
          <div className="flex gap-1">
            {task.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium"
                style={{ backgroundColor: label.color + "25", color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge
          status={task.status}
          onClick={onStatusCycle ? (nextStatus) => onStatusCycle(task.id, nextStatus) : undefined}
        />
        <PriorityBadge
          priority={task.priority}
          onClick={onPriorityChange ? (newPriority) => onPriorityChange(task.id, newPriority) : undefined}
        />

        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 text-xs rounded-md px-1.5 py-0.5 transition-colors",
              isOverdue
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:bg-muted",
              !task.due_date && "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted",
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (onDateChange) setShowDatePicker((prev) => !prev);
            }}
            title={onDateChange ? "Change due date" : undefined}
          >
            <Calendar size={12} />
            {task.due_date
              ? new Date(task.due_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "No date"}
          </button>

          {showDatePicker && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDatePicker(false);
                }}
              />
              <div
                className="absolute right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex gap-1.5 mb-2.5">
                  {getQuickPickDates().map((pick) => (
                    <button
                      key={pick.label}
                      type="button"
                      className={cn(
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-center",
                        task.due_date === pick.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      )}
                      onClick={() => handleDateSelect(pick.value)}
                    >
                      {pick.label}
                    </button>
                  ))}
                </div>
                <MiniCalendar
                  selectedDate={task.due_date}
                  onSelect={handleDateSelect}
                />
              </div>
            </>
          )}
        </div>

        {task.subtask_count > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${(task.subtask_done_count / task.subtask_count) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {task.subtask_done_count}/{task.subtask_count}
            </span>
          </div>
        )}

        {isExpanded ? (
          <ChevronDown size={16} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
