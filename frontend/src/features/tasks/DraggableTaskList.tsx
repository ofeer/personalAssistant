import { useCallback, useState, useEffect } from "react";
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
import { GripVertical } from "lucide-react";

import type { Task, TaskGroup } from "@/types/tasks";
import { TaskCard } from "./TaskCard";
import { TaskDetailInline } from "./TaskDetailInline";

interface DraggableTaskListProps {
  tasks: Task[];
  groups: TaskGroup[];
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onStatusCycle?: (taskId: string, newStatus: string) => void;
  onPriorityChange?: (taskId: string, newPriority: number) => void;
  onDateChange?: (taskId: string, newDate: string) => void;
  onTaskClick: (taskId: string) => void;
  onReorder: (items: { id: string; sort_order: number }[]) => void;
  expandedTaskId?: string | null;
  onCloseDetail?: () => void;
}

export function DraggableTaskList({
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
}: DraggableTaskListProps) {
  const [localTasks, setLocalTasks] = useState(tasks);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = localTasks.findIndex((task) => task.id === active.id);
      const newIndex = localTasks.findIndex((task) => task.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(localTasks, oldIndex, newIndex);
      setLocalTasks(reordered);

      const items = reordered.map((task, index) => ({
        id: task.id,
        sort_order: index,
      }));
      onReorder(items);
    },
    [localTasks, onReorder],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {localTasks.map((task) => (
            <div key={task.id}>
              <SortableTaskCard
                task={task}
                groups={groups}
                onToggleStatus={onToggleStatus}
                onStatusCycle={onStatusCycle}
                onPriorityChange={onPriorityChange}
                onDateChange={onDateChange}
                onClick={onTaskClick}
                isExpanded={expandedTaskId === task.id}
              />
              {expandedTaskId === task.id && (
                <TaskDetailInline
                  taskId={task.id}
                  groups={groups}
                  onClose={() => onCloseDetail?.()}
                />
              )}
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTaskCard({
  task,
  groups,
  onToggleStatus,
  onStatusCycle,
  onPriorityChange,
  onDateChange,
  onClick,
  isExpanded,
}: {
  task: Task;
  groups: TaskGroup[];
  onToggleStatus: (taskId: string, currentStatus: string) => void;
  onStatusCycle?: (taskId: string, newStatus: string) => void;
  onPriorityChange?: (taskId: string, newPriority: number) => void;
  onDateChange?: (taskId: string, newDate: string) => void;
  onClick: (taskId: string) => void;
  isExpanded: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <TaskCard
          task={task}
          groups={groups}
          onToggleStatus={onToggleStatus}
          onStatusCycle={onStatusCycle}
          onPriorityChange={onPriorityChange}
          onDateChange={onDateChange}
          onClick={onClick}
          isExpanded={isExpanded}
        />
      </div>
    </div>
  );
}
