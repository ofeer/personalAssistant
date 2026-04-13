export interface TaskGroup {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  group_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  due_date: string | null;
  due_time: string | null;
  recurrence: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number;
  subtask_count: number;
  subtask_done_count: number;
  labels: Label[];
}

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string;
  type: string;
  is_sent: boolean;
  created_at: string;
}

export interface TaskDetail extends Task {
  subtasks: Task[];
  reminders: Reminder[];
  group: TaskGroup | null;
  labels: Label[];
}

export interface DailySummary {
  overdue_count: number;
  today_tasks: Task[];
  upcoming_tasks: Task[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: number;
  status?: string;
  due_date?: string;
  due_time?: string;
  recurrence?: string;
  group_id?: string;
  parent_task_id?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: number;
  status?: string;
  due_date?: string;
  due_time?: string;
  recurrence?: string;
  group_id?: string;
}

export interface CreateTaskGroupPayload {
  name: string;
  color?: string;
}

export interface UpdateTaskGroupPayload {
  name?: string;
  color?: string;
  sort_order?: number;
}

export interface CreateReminderPayload {
  remind_at: string;
  type?: "push" | "email";
}

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CreateLabelPayload {
  name: string;
  color?: string;
}

export interface UpdateLabelPayload {
  name?: string;
  color?: string;
}
