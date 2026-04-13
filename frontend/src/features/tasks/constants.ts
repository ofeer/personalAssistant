export const PRIORITY_LABELS = ["None", "Low", "Medium", "High", "Urgent"] as const;
export const PRIORITY_COLORS = [
  "text-muted-foreground bg-muted",
  "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40",
  "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/40",
  "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/40",
  "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40",
] as const;

export const STATUS_OPTIONS = ["todo", "in_progress", "done", "cancelled"] as const;
export const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const VIEW_OPTIONS = ["tasks", "groups"] as const;
export const VIEW_LABELS: Record<string, string> = {
  tasks: "Tasks",
  groups: "Groups",
};

export const RECURRENCE_OPTIONS = [
  { value: "", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

export const GROUP_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
] as const;
