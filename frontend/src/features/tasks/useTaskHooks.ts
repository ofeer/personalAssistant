import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { tasksApi } from "./api";
import type {
  CreateLabelPayload,
  CreateReminderPayload,
  CreateTaskGroupPayload,
  CreateTaskPayload,
  Task,
  UpdateLabelPayload,
  UpdateTaskGroupPayload,
  UpdateTaskPayload,
} from "@/types/tasks";

const TASKS_KEY = ["tasks"];
const GROUPS_KEY = ["task-groups"];
const LABELS_KEY = ["task-labels"];
const taskDetailKey = (id: string) => ["tasks", id];

export function useTasks(view: string, filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: [...TASKS_KEY, view, filters],
    queryFn: () => tasksApi.getTasks(view, filters),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskDetailKey(id),
    queryFn: () => tasksApi.getTask(id),
    enabled: !!id,
  });
}

export function useTaskGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: tasksApi.getGroups,
  });
}

export function useDailySummary() {
  return useQuery({
    queryKey: [...TASKS_KEY, "daily-summary"],
    queryFn: tasksApi.getDailySummary,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.createTask(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTaskPayload) =>
      tasksApi.updateTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tasksApi.updateTaskStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      tasksApi.reorderTasks(items),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const orderMap = new Map(items.map((item) => [item.id, item.sort_order]));
      queryClient.setQueriesData<Task[]>(
        { queryKey: TASKS_KEY },
        (old) =>
          old?.map((task) =>
            orderMap.has(task.id)
              ? { ...task, sort_order: orderMap.get(task.id)! }
              : task,
          ) ?? old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskGroupPayload) =>
      tasksApi.createGroup(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTaskGroupPayload }) =>
      tasksApi.updateGroup(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useCreateReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReminderPayload) =>
      tasksApi.createReminder(taskId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) }),
  });
}

export function useDeleteReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) => tasksApi.deleteReminder(reminderId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) }),
  });
}

// ── Labels ──────────────────────────────────────────────────

export function useLabels() {
  return useQuery({
    queryKey: LABELS_KEY,
    queryFn: tasksApi.getLabels,
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLabelPayload) => tasksApi.createLabel(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LABELS_KEY }),
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLabelPayload }) =>
      tasksApi.updateLabel(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LABELS_KEY }),
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LABELS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useAssignLabel(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => tasksApi.assignLabel(taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useUnassignLabel(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => tasksApi.unassignLabel(taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}
