# Phase 2: Task Manager

## Overview

A full task management feature with support for day/priority/group views, subtasks, recurring tasks, reminders, and browser push notifications. Follows the same architectural patterns established in Phase 1 (Shopping List).

---

## Prerequisites

- Phase 1 (Shopping List) is complete and working.
- The existing backend patterns are: routes in `backend/app/api/v1/routes/`, models in `backend/app/models/`, services in `backend/app/services/`, Supabase client via `get_supabase()`.
- The existing frontend patterns are: feature folder in `frontend/src/features/`, types in `frontend/src/types/`, TanStack Query hooks, axios API layer, shadcn-style UI components.
- Auth is handled via `get_current_user` dependency (backend) and `useAuth` hook (frontend).

---

## Database (Supabase Migration)

Create `supabase/migrations/002_tasks.sql`:

### Tables

```sql
CREATE TABLE task_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES task_groups(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,  -- 0=none, 1=low, 2=medium, 3=high, 4=urgent
  status TEXT DEFAULT 'todo',  -- 'todo', 'in_progress', 'done', 'cancelled'
  due_date DATE,
  due_time TIME,
  recurrence TEXT,  -- 'daily', 'weekly', 'monthly', or null
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE task_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'push',  -- 'push', 'email'
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

```sql
CREATE INDEX idx_task_groups_user_id ON task_groups(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_group_id ON tasks(group_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_due_date ON tasks(user_id, due_date);
CREATE INDEX idx_tasks_status ON tasks(user_id, status);
CREATE INDEX idx_task_reminders_remind_at ON task_reminders(remind_at) WHERE NOT is_sent;
```

### RLS Policies

```sql
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own task groups" ON task_groups
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reminders for own tasks" ON task_reminders
  FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));
```

### Trigger

Reuse the existing `update_updated_at()` function from migration 001:
```sql
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Backend

### Models — `backend/app/models/tasks.py`

Create Pydantic models:

- `TaskGroupCreate(name: str, color: str = '#6366f1')`
- `TaskGroupUpdate(name: str | None, color: str | None, sort_order: int | None)`
- `TaskGroupResponse(id, user_id, name, color, sort_order, created_at)`
- `TaskCreate(title: str, description: str | None, priority: int = 0, status: str = 'todo', due_date: date | None, due_time: time | None, recurrence: str | None, group_id: str | None, parent_task_id: str | None)`
- `TaskUpdate(title, description, priority, status, due_date, due_time, recurrence, group_id)` — all optional
- `TaskResponse(id, user_id, group_id, parent_task_id, title, description, priority, status, due_date, due_time, recurrence, completed_at, created_at, updated_at, subtask_count: int, subtask_done_count: int)`
- `TaskDetailResponse` — extends TaskResponse with `subtasks: list[TaskResponse]`, `reminders: list[ReminderResponse]`, `group: TaskGroupResponse | None`
- `ReminderCreate(remind_at: datetime, type: str = 'push')`
- `ReminderResponse(id, task_id, remind_at, type, is_sent, created_at)`

Validate: `priority` in 0..4, `status` in `['todo', 'in_progress', 'done', 'cancelled']`, `recurrence` in `['daily', 'weekly', 'monthly']` or null.

### Service — `backend/app/services/tasks.py`

Class `TaskService` following the same pattern as `ShoppingService`:

**Task Group methods:**
- `get_groups(user_id)` — list all groups ordered by sort_order
- `create_group(user_id, payload)` / `update_group(group_id, user_id, payload)` / `delete_group(group_id, user_id)`

**Task methods:**
- `get_tasks(user_id, view, filters)` — the main query endpoint:
  - `view=today` — tasks where due_date = today, or overdue (due_date < today and status != done)
  - `view=week` — tasks where due_date is within next 7 days
  - `view=priority` — all non-done tasks ordered by priority desc
  - `view=group` — all non-done tasks grouped by group_id
  - Optional filters: `status`, `group_id`, `priority`
- `get_task(task_id, user_id)` — single task with subtasks, reminders, group
- `create_task(user_id, payload)` — create task; if parent_task_id is set, verify parent exists and belongs to user
- `update_task(task_id, user_id, payload)` — update task; if status changes to 'done', set completed_at = now(); if changed from 'done', clear completed_at
- `delete_task(task_id, user_id)`
- `get_daily_summary(user_id)` — return: overdue count, today's tasks, upcoming (next 3 days)

**Reminder methods:**
- `create_reminder(task_id, user_id, payload)`
- `delete_reminder(reminder_id, user_id)`
- `get_pending_reminders()` — for background job: reminders where remind_at <= now() and is_sent = false

**Recurring tasks:**
- When a recurring task is completed, automatically create the next occurrence (same title, description, priority, group, with new due_date shifted by the recurrence interval).

### Routes — `backend/app/api/v1/routes/tasks.py`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/task-groups` | List all groups |
| POST | `/api/v1/task-groups` | Create group |
| PATCH | `/api/v1/task-groups/{id}` | Update group |
| DELETE | `/api/v1/task-groups/{id}` | Delete group |
| GET | `/api/v1/tasks` | List tasks (query params: `view`, `status`, `group_id`, `priority`) |
| POST | `/api/v1/tasks` | Create task |
| GET | `/api/v1/tasks/{id}` | Get task detail (with subtasks + reminders) |
| PATCH | `/api/v1/tasks/{id}` | Update task |
| DELETE | `/api/v1/tasks/{id}` | Delete task |
| PATCH | `/api/v1/tasks/{id}/status` | Quick status change (body: `{ status: string }`) |
| GET | `/api/v1/tasks/daily-summary` | Today's summary |
| POST | `/api/v1/tasks/{id}/reminders` | Add reminder to task |
| DELETE | `/api/v1/reminders/{id}` | Delete reminder |

### Register router

In `backend/app/main.py`, add:
```python
from app.api.v1.routes.tasks import router as tasks_router
app.include_router(tasks_router, prefix="/api/v1")
```

### Background Reminder Job (optional, can defer)

See [FEATURES.md](../../FEATURES.md#task-reminders) for the full reminder flow, delivery roadmap (v1 logging → v2 browser push → v3 Telegram), database table, and background job design.

---

## Frontend

### Types — `frontend/src/types/tasks.ts`

Mirror the backend response models as TypeScript interfaces:
- `TaskGroup`, `Task`, `TaskDetail`, `Reminder`
- `CreateTaskPayload`, `UpdateTaskPayload`, `CreateTaskGroupPayload`, `CreateReminderPayload`

### Constants — `frontend/src/features/tasks/constants.ts`

```typescript
export const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High', 'Urgent'] as const;
export const PRIORITY_COLORS = ['gray', 'blue', 'yellow', 'orange', 'red'] as const;
export const STATUS_OPTIONS = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export const VIEW_OPTIONS = ['today', 'week', 'priority', 'group'] as const;
```

### API — `frontend/src/features/tasks/api.ts`

Wrap all endpoints using the existing `api` axios instance from `@/lib/api`.

### Hooks — `frontend/src/features/tasks/useTasksHooks.ts`

TanStack Query hooks:
- `useTasks(view, filters)` — list tasks with query params
- `useTask(id)` — single task detail
- `useTaskGroups()` — list groups
- `useCreateTask()`, `useUpdateTask()`, `useDeleteTask()`, `useUpdateTaskStatus()`
- `useCreateGroup()`, `useUpdateGroup()`, `useDeleteGroup()`
- `useCreateReminder(taskId)`, `useDeleteReminder(taskId)`
- `useDailySummary()`

### Pages

**`/tasks`** — Main task view page
- Toggle bar at top to switch between views: Today, This Week, Priority, Group
- Each view renders a different layout:
  - **Today view**: sections for "Overdue", "Today", "Tomorrow" — tasks as compact cards
  - **Week view**: day-by-day sections for the next 7 days
  - **Priority view**: columns or sections for Urgent, High, Medium, Low, None
  - **Group view**: sections per task group, plus "Ungrouped" at the bottom
- Floating "+" button to create a new task (opens a dialog/slide-over)
- Clicking a task opens the detail panel

**`/tasks/:id`** — Task detail page (or slide-over panel from the list)
- Full task info: title, description, priority badge, status badge, due date, group
- Subtask list with inline add
- Reminders list with add picker
- Edit form
- Delete button

### Components — `frontend/src/features/tasks/`

- `TaskCard` — compact card: checkbox, title, priority indicator, due date, group color dot
- `TaskForm` — create/edit form in a Dialog: title, description, priority select, status select, due date picker, group select, recurrence select
- `TaskDetailPanel` — slide-over or full page for single task
- `ViewToggle` — segmented control to switch views
- `TaskGroupHeader` — collapsible section header with group color and name
- `SubtaskList` — indented list of child tasks with inline add
- `ReminderPicker` — date/time picker for adding reminders
- `PriorityBadge` — colored badge showing priority level
- `StatusBadge` — badge showing current status

### New UI components needed (add to `frontend/src/components/ui/`)

- `Badge.tsx` — small colored pill for tags/status/priority
- `Tabs.tsx` — segmented control / tab bar component
- `DatePicker.tsx` — basic date input wrapper (can use native `<input type="date">` initially)
- `SlideOver.tsx` — slide-in panel from the right side (for task detail on desktop)

### Sidebar update

Add "Tasks" to the nav items in `frontend/src/components/layout/Sidebar.tsx`:
```typescript
import { ShoppingCart, CheckSquare, X } from "lucide-react";

const navItems = [
  { to: "/shopping", label: "Shopping Lists", icon: ShoppingCart },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
];
```

### App.tsx route registration

Add inside the `<AppShell>` route group:
```tsx
<Route path="/tasks" element={<TasksPage />} />
<Route path="/tasks/:id" element={<TaskDetailPage />} />
```

### Notifications (stretch — can defer to after basic CRUD works)

See [FEATURES.md](../../FEATURES.md#task-reminders) for the full notification delivery plan (Service Worker, Web Push, daily summary).

---

## Seed Data (optional)

Create `supabase/seed_tasks_mock.sql` with sample task groups ("Work", "Personal", "Home"), sample tasks with varying priorities and due dates, and a few subtasks.

---

## Testing Checklist

- [ ] Create, edit, delete task groups
- [ ] Create task with all fields (title, description, priority, due date, group, recurrence)
- [ ] Edit task, change status, verify completed_at is set/cleared
- [ ] Create subtasks under a parent task
- [ ] View toggle works: today, week, priority, group views all show correct data
- [ ] Overdue tasks show in today view
- [ ] Delete a task (with subtasks — cascading)
- [ ] Add/delete reminders
- [ ] Recurring task: complete a daily task, verify a new one is created for next day
- [ ] Daily summary endpoint returns correct counts
- [ ] Mobile responsive: all views work on small screens
