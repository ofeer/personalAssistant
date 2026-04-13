import { Badge } from "@/components/ui/Badge";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { STATUS_LABELS, STATUS_OPTIONS } from "./constants";

const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted-foreground bg-muted",
  in_progress: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40",
  done: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40",
  cancelled: "text-muted-foreground bg-muted line-through",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  cancelled: "bg-gray-400",
};

interface StatusBadgeProps {
  status: string;
  onClick?: (nextStatus: string) => void;
}

export function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const badge = (
    <Badge className={`${STATUS_COLORS[status] ?? STATUS_COLORS.todo}${onClick ? " cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );

  if (!onClick) return badge;

  return (
    <Popover trigger={badge} align="right">
      {STATUS_OPTIONS.map((opt) => (
        <PopoverItem
          key={opt}
          onClick={() => onClick(opt)}
          active={opt === status}
        >
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[opt] ?? "bg-gray-400"}`} />
          {STATUS_LABELS[opt]}
        </PopoverItem>
      ))}
    </Popover>
  );
}
