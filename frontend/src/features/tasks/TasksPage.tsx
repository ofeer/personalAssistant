import { useState, useMemo, useCallback } from "react";
import { Plus, ListChecks, Settings2, ChevronDown, ChevronRight as ChevronRightIcon, Search, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Dialog, DialogTitle } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { Task, TaskGroup, CreateTaskPayload } from "@/types/tasks";
import { tasksApi } from "./api";
import {
  useTasks,
  useTaskGroups,
  useCreateTask,
  useUpdateTaskStatus,
  useCreateGroup,
  useDeleteGroup,
  useReorderTasks,
  useLabels,
} from "./useTaskHooks";
import { VIEW_OPTIONS, VIEW_LABELS, GROUP_COLORS, PRIORITY_LABELS, STATUS_OPTIONS, STATUS_LABELS } from "./constants";
import { DraggableTaskList } from "./DraggableTaskList";
import { TaskForm } from "./TaskForm";
import { LabelManager } from "./LabelManager";

export function TasksPage() {
  const [view, setView] = useState<string>("tasks");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState<string>(GROUP_COLORS[0]);

  const [showLabelManager, setShowLabelManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterGroupId, setFilterGroupId] = useState<string>("");
  const [filterLabelId, setFilterLabelId] = useState<string>("");

  const backendView = view === "tasks" ? "all" : "group";
  const { data: tasks, isLoading } = useTasks(backendView);
  const { data: groups = [] } = useTaskGroups();
  const { data: labels = [] } = useLabels();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const toggleStatus = useUpdateTaskStatus();
  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) =>
      tasksApi.updateTask(id, { priority }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const dateMutation = useMutation({
    mutationFn: ({ id, due_date }: { id: string; due_date: string }) =>
      tasksApi.updateTask(id, { due_date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const reorderTasks = useReorderTasks();
  const { toast } = useToast();

  const hasActiveFilters = searchQuery || filterPriority || filterStatus || filterGroupId || filterLabelId;
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterPriority && task.priority !== Number(filterPriority)) return false;
      if (filterStatus && task.status !== filterStatus) return false;
      if (filterGroupId && task.group_id !== filterGroupId) return false;
      if (filterLabelId && !task.labels?.some((label) => label.id === filterLabelId)) return false;
      return true;
    });
  }, [tasks, searchQuery, filterPriority, filterStatus, filterGroupId, filterLabelId]);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterPriority("");
    setFilterStatus("");
    setFilterGroupId("");
    setFilterLabelId("");
  };

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    try {
      await toggleStatus.mutateAsync({ id: taskId, status: newStatus });
    } catch {
      toast("Failed to update task", "error");
    }
  };

  const handleCreateTask = async (payload: Parameters<typeof createTask.mutateAsync>[0]) => {
    try {
      await createTask.mutateAsync(payload);
      setShowCreateForm(false);
      toast("Task created");
    } catch {
      toast("Failed to create task", "error");
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup.mutateAsync({ name: newGroupName.trim(), color: newGroupColor });
      setNewGroupName("");
      setShowGroupDialog(false);
      toast("Group created");
    } catch {
      toast("Failed to create group", "error");
    }
  };

  const handleReorder = (items: { id: string; sort_order: number }[]) => {
    reorderTasks.mutate(items);
  };

  const handleStatusCycle = async (taskId: string, newStatus: string) => {
    try {
      await toggleStatus.mutateAsync({ id: taskId, status: newStatus });
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const handlePriorityChange = useCallback(async (taskId: string, newPriority: number) => {
    try {
      await priorityMutation.mutateAsync({ id: taskId, priority: newPriority });
    } catch {
      toast("Failed to update priority", "error");
    }
  }, [priorityMutation, toast]);

  const handleDateChange = useCallback(async (taskId: string, newDate: string) => {
    try {
      await dateMutation.mutateAsync({ id: taskId, due_date: newDate });
    } catch {
      toast("Failed to update due date", "error");
    }
  }, [dateMutation, toast]);

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`Delete group "${name}"? Tasks in this group won't be deleted.`)) return;
    try {
      await deleteGroup.mutateAsync(groupId);
      toast("Group deleted");
    } catch {
      toast("Failed to delete group", "error");
    }
  };

  const handleTaskClick = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const viewOptions = VIEW_OPTIONS.map((opt) => ({
    value: opt,
    label: VIEW_LABELS[opt],
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowLabelManager(true)}>
            Labels
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowGroupDialog(true)}>
            <Settings2 size={16} /> Groups
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus size={16} /> New Task
          </Button>
        </div>
      </div>

      <Tabs options={viewOptions} value={view} onChange={setView} className="mb-6" />

      <QuickAddInput view={view} onAdd={handleCreateTask} />

      {/* Search & Filter Bar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)} className="h-8 text-xs w-28">
            <option value="">Priority</option>
            {PRIORITY_LABELS.map((label, index) => (
              <option key={index} value={index}>{label}</option>
            ))}
          </Select>
          <Select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="h-8 text-xs w-28">
            <option value="">Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{STATUS_LABELS[opt]}</option>
            ))}
          </Select>
          {groups.length > 0 && (
            <Select value={filterGroupId} onChange={(event) => setFilterGroupId(event.target.value)} className="h-8 text-xs w-28">
              <option value="">Group</option>
              {groups.map((grp) => (
                <option key={grp.id} value={grp.id}>{grp.name}</option>
              ))}
            </Select>
          )}
          {labels.length > 0 && (
            <Select value={filterLabelId} onChange={(event) => setFilterLabelId(event.target.value)} className="h-8 text-xs w-28">
              <option value="">Label</option>
              {labels.map((label) => (
                <option key={label.id} value={label.id}>{label.name}</option>
              ))}
            </Select>
          )}
          {hasActiveFilters && (
            <Button size="sm" variant="outline" onClick={clearFilters} className="h-8 text-xs">
              <X size={12} /> Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !filteredTasks.length ? (
        <EmptyState
          icon={<ListChecks size={48} />}
          title={hasActiveFilters ? "No matching tasks" : "No tasks"}
          description={
            hasActiveFilters
              ? "Try adjusting your filters."
              : "Create your first task to get started."
          }
          action={
            hasActiveFilters ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus size={16} /> Create Task
              </Button>
            )
          }
        />
      ) : view === "tasks" ? (
        <DateSectionsView
          tasks={filteredTasks}
          groups={groups}
          onToggleStatus={handleToggleStatus}
          onStatusCycle={handleStatusCycle}
          onPriorityChange={handlePriorityChange}
          onDateChange={handleDateChange}
          onTaskClick={handleTaskClick}
          onReorder={handleReorder}
          expandedTaskId={expandedTaskId}
          onCloseDetail={() => setExpandedTaskId(null)}
        />
      ) : (
        <GroupView
          tasks={filteredTasks}
          groups={groups}
          onToggleStatus={handleToggleStatus}
          onStatusCycle={handleStatusCycle}
          onPriorityChange={handlePriorityChange}
          onDateChange={handleDateChange}
          onTaskClick={handleTaskClick}
          onReorder={handleReorder}
          expandedTaskId={expandedTaskId}
          onCloseDetail={() => setExpandedTaskId(null)}
        />
      )}

      <TaskForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateTask}
        groups={groups}
        isSubmitting={createTask.isPending}
      />

      <LabelManager open={showLabelManager} onClose={() => setShowLabelManager(false)} />

      {/* Group management dialog */}
      <Dialog open={showGroupDialog} onClose={() => setShowGroupDialog(false)}>
        <DialogTitle>Task Groups</DialogTitle>
        <div className="mt-4 space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="text-sm font-medium">{group.name}</span>
              </div>
              <button
                onClick={() => handleDeleteGroup(group.id, group.name)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="New group name..."
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="h-8 text-sm"
              onKeyDown={(event) => { if (event.key === "Enter") handleCreateGroup(); }}
            />
            <div className="flex gap-1">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color}
                  className="h-8 w-8 shrink-0 rounded-md border-2 transition-transform"
                  style={{
                    backgroundColor: color,
                    borderColor: color === newGroupColor ? "var(--color-foreground)" : "transparent",
                    transform: color === newGroupColor ? "scale(1.1)" : "scale(1)",
                  }}
                  onClick={() => setNewGroupColor(color)}
                />
              ))}
            </div>
            <Button size="sm" onClick={handleCreateGroup} disabled={createGroup.isPending}>
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ── Quick-add input ────────────────────────────────────────────

function QuickAddInput({
  view,
  onAdd,
}: {
  view: string;
  onAdd: (payload: CreateTaskPayload) => void;
}) {
  const [value, setValue] = useState("");

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !value.trim()) return;
    event.preventDefault();

    const payload: CreateTaskPayload = {
      title: value.trim(),
      priority: 2,
      status: "todo",
    };
    if (view === "tasks") {
      payload.due_date = new Date().toISOString().split("T")[0];
    }
    onAdd(payload);
    setValue("");
  };

  return (
    <div className="mb-4">
      <Input
        placeholder="Add a task... (press Enter)"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        className="h-9 text-sm"
      />
    </div>
  );
}

// ── Collapsible section ────────────────────────────────────────

function CollapsibleSection({
  title,
  count,
  defaultExpanded,
  children,
}: {
  title: string;
  count: number;
  defaultExpanded: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (count === 0) return null;

  return (
    <div>
      <button
        className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
        {title} ({count})
      </button>
      {expanded && children}
    </div>
  );
}

// ── Helper: split tasks by done status ─────────────────────────

function splitByDone(tasks: Task[]) {
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const task of tasks) {
    if (task.status === "done") completed.push(task);
    else active.push(task);
  }
  return { active, completed };
}

// ── Helper: bucket tasks by date ───────────────────────────────

function bucketByDate(tasks: Task[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const buckets = {
    today: [] as Task[],
    tomorrow: [] as Task[],
    thisWeek: [] as Task[],
    later: [] as Task[],
    completed: [] as Task[],
  };

  for (const task of tasks) {
    if (task.status === "done") {
      buckets.completed.push(task);
      continue;
    }
    if (!task.due_date) {
      buckets.later.push(task);
      continue;
    }
    const dueDate = new Date(task.due_date + "T00:00:00");
    if (dueDate < today || (dueDate.getTime() === today.getTime())) {
      buckets.today.push(task);
    } else if (dueDate.getTime() === tomorrow.getTime()) {
      buckets.tomorrow.push(task);
    } else if (dueDate < weekEnd) {
      buckets.thisWeek.push(task);
    } else {
      buckets.later.push(task);
    }
  }

  return buckets;
}

// ── Shared view props ──────────────────────────────────────────

interface ViewProps {
  tasks: Task[];
  groups: TaskGroup[];
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onStatusCycle: (taskId: string, newStatus: string) => void;
  onPriorityChange: (taskId: string, newPriority: number) => void;
  onDateChange: (taskId: string, newDate: string) => void;
  onTaskClick: (taskId: string) => void;
  onReorder: (items: { id: string; sort_order: number }[]) => void;
  expandedTaskId: string | null;
  onCloseDetail: () => void;
}

// ── Date Sections View (Tasks tab) ─────────────────────────────

function DateSectionsView({
  tasks,
  groups,
  onToggleStatus,
  onStatusCycle,
  onPriorityChange,
  onDateChange,
  onTaskClick,
  onReorder,
  expandedTaskId,
  onCloseDetail,
}: ViewProps) {
  const buckets = useMemo(() => bucketByDate(tasks), [tasks]);

  const sections = [
    { key: "today", title: "Today", tasks: buckets.today, defaultExpanded: true },
    { key: "tomorrow", title: "Tomorrow", tasks: buckets.tomorrow, defaultExpanded: true },
    { key: "thisWeek", title: "This Week", tasks: buckets.thisWeek, defaultExpanded: false },
    { key: "later", title: "Later", tasks: buckets.later, defaultExpanded: false },
    { key: "completed", title: "Completed", tasks: buckets.completed, defaultExpanded: false },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <CollapsibleSection
          key={section.key}
          title={section.title}
          count={section.tasks.length}
          defaultExpanded={section.defaultExpanded}
        >
          <DraggableTaskList
            tasks={section.tasks}
            groups={groups}
            onToggleStatus={onToggleStatus}
            onStatusCycle={onStatusCycle}
            onPriorityChange={onPriorityChange}
            onDateChange={onDateChange}
            onTaskClick={onTaskClick}
            onReorder={onReorder}
            expandedTaskId={expandedTaskId}
            onCloseDetail={onCloseDetail}
          />
        </CollapsibleSection>
      ))}
    </div>
  );
}

// ── Group View (Groups tab) ────────────────────────────────────

function GroupView({
  tasks,
  groups,
  onToggleStatus,
  onStatusCycle,
  onPriorityChange,
  onDateChange,
  onTaskClick,
  onReorder,
  expandedTaskId,
  onCloseDetail,
}: ViewProps) {
  const { active, completed } = splitByDone(tasks);
  const grouped = groups.map((group) => ({
    group,
    items: active.filter((task) => task.group_id === group.id),
  }));
  const ungrouped = active.filter((task) => !task.group_id);

  return (
    <div className="space-y-6">
      {grouped.map(({ group, items }) =>
        items.length > 0 ? (
          <CollapsibleSection
            key={group.id}
            title={group.name}
            count={items.length}
            defaultExpanded={true}
          >
            <DraggableTaskList
              tasks={items}
              groups={groups}
              onToggleStatus={onToggleStatus}
              onStatusCycle={onStatusCycle}
              onPriorityChange={onPriorityChange}
              onDateChange={onDateChange}
              onTaskClick={onTaskClick}
              onReorder={onReorder}
              expandedTaskId={expandedTaskId}
              onCloseDetail={onCloseDetail}
            />
          </CollapsibleSection>
        ) : null,
      )}
      {ungrouped.length > 0 && (
        <CollapsibleSection
          title="Ungrouped"
          count={ungrouped.length}
          defaultExpanded={true}
        >
          <DraggableTaskList
            tasks={ungrouped}
            groups={groups}
            onToggleStatus={onToggleStatus}
            onStatusCycle={onStatusCycle}
            onPriorityChange={onPriorityChange}
            onDateChange={onDateChange}
            onTaskClick={onTaskClick}
            onReorder={onReorder}
            expandedTaskId={expandedTaskId}
            onCloseDetail={onCloseDetail}
          />
        </CollapsibleSection>
      )}
      <CollapsibleSection
        title="Completed"
        count={completed.length}
        defaultExpanded={false}
      >
        <DraggableTaskList
          tasks={completed}
          groups={groups}
          onToggleStatus={onToggleStatus}
          onStatusCycle={onStatusCycle}
          onPriorityChange={onPriorityChange}
          onDateChange={onDateChange}
          onTaskClick={onTaskClick}
          onReorder={onReorder}
          expandedTaskId={expandedTaskId}
          onCloseDetail={onCloseDetail}
        />
      </CollapsibleSection>
    </div>
  );
}
