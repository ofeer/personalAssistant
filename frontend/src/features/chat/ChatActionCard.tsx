import { CheckCircle2, XCircle } from "lucide-react";

import type { IChatAction } from "@/types/chat";

const TOOL_LABELS: Record<string, string> = {
  add_shopping_item: "Added item",
  remove_shopping_item: "Removed item",
  check_shopping_item: "Updated item",
  check_all_shopping_items: "Updated all items",
  create_shopping_list: "Created list",
  get_shopping_lists: "Fetched lists",
  get_shopping_list_detail: "Fetched list details",
  create_task: "Created task",
  complete_task: "Completed task",
  delete_task: "Deleted task",
  get_tasks: "Fetched tasks",
  get_daily_summary: "Fetched summary",
  get_task_groups: "Fetched groups",
  get_everything_summary: "Fetched overview",
};

interface ChatActionCardProps {
  action: IChatAction;
}

export function ChatActionCard({ action }: ChatActionCardProps) {
  const label = TOOL_LABELS[action.tool_name] ?? action.tool_name;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
        action.success
          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      {action.success ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{label}</span>
      {action.error && <span className="text-red-500">— {action.error}</span>}
    </div>
  );
}
