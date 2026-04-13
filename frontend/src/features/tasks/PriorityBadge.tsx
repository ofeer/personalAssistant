import { Badge } from "@/components/ui/Badge";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "./constants";

const PRIORITY_DOT_COLORS = [
  "bg-gray-400",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
];

interface PriorityBadgeProps {
  priority: number;
  onClick?: (newPriority: number) => void;
}

export function PriorityBadge({ priority, onClick }: PriorityBadgeProps) {
  if (priority === 0 && !onClick) return null;

  const badge = (
    <Badge className={`${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS[0]}${onClick ? " cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
      {PRIORITY_LABELS[priority] ?? "None"}
    </Badge>
  );

  if (!onClick) return badge;

  return (
    <Popover trigger={badge} align="right">
      {PRIORITY_LABELS.map((label, index) => (
        <PopoverItem
          key={index}
          onClick={() => onClick(index)}
          active={index === priority}
        >
          <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT_COLORS[index]}`} />
          {label}
        </PopoverItem>
      ))}
    </Popover>
  );
}
