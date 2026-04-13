import { api } from "@/lib/api";
import type {
  CreateLabelPayload,
  CreateReminderPayload,
  CreateTaskGroupPayload,
  CreateTaskPayload,
  DailySummary,
  Label,
  Reminder,
  Task,
  TaskDetail,
  TaskGroup,
  UpdateLabelPayload,
  UpdateTaskGroupPayload,
  UpdateTaskPayload,
} from "@/types/tasks";

export const tasksApi = {
  // Task Groups
  getGroups: () =>
    api.get<TaskGroup[]>("/task-groups").then((res) => res.data),

  createGroup: (payload: CreateTaskGroupPayload) =>
    api.post<TaskGroup>("/task-groups", payload).then((res) => res.data),

  updateGroup: (id: string, payload: UpdateTaskGroupPayload) =>
    api.patch<TaskGroup>(`/task-groups/${id}`, payload).then((res) => res.data),

  deleteGroup: (id: string) => api.delete(`/task-groups/${id}`),

  // Tasks
  getTasks: (view: string, filters?: Record<string, string | number>) =>
    api
      .get<Task[]>("/tasks", { params: { view, ...filters } })
      .then((res) => res.data),

  getTask: (id: string) =>
    api.get<TaskDetail>(`/tasks/${id}`).then((res) => res.data),

  createTask: (payload: CreateTaskPayload) =>
    api.post<Task>("/tasks", payload).then((res) => res.data),

  updateTask: (id: string, payload: UpdateTaskPayload) =>
    api.patch<Task>(`/tasks/${id}`, payload).then((res) => res.data),

  deleteTask: (id: string) => api.delete(`/tasks/${id}`),

  updateTaskStatus: (id: string, status: string) =>
    api.patch<Task>(`/tasks/${id}/status`, { status }).then((res) => res.data),

  getDailySummary: () =>
    api.get<DailySummary>("/tasks/daily-summary").then((res) => res.data),

  reorderTasks: (items: { id: string; sort_order: number }[]) =>
    api.put("/tasks/reorder", { items }),

  // Reminders
  createReminder: (taskId: string, payload: CreateReminderPayload) =>
    api
      .post<Reminder>(`/tasks/${taskId}/reminders`, payload)
      .then((res) => res.data),

  deleteReminder: (reminderId: string) =>
    api.delete(`/reminders/${reminderId}`),

  // Labels
  getLabels: () =>
    api.get<Label[]>("/task-labels").then((res) => res.data),

  createLabel: (payload: CreateLabelPayload) =>
    api.post<Label>("/task-labels", payload).then((res) => res.data),

  updateLabel: (id: string, payload: UpdateLabelPayload) =>
    api.patch<Label>(`/task-labels/${id}`, payload).then((res) => res.data),

  deleteLabel: (id: string) =>
    api.delete(`/task-labels/${id}`),

  assignLabel: (taskId: string, labelId: string) =>
    api.post(`/tasks/${taskId}/labels/${labelId}`),

  unassignLabel: (taskId: string, labelId: string) =>
    api.delete(`/tasks/${taskId}/labels/${labelId}`),
};
