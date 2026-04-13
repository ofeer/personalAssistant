# Phase 3: Project Manager

## Overview

A project management feature for tracking personal projects with budgets, expenses, file uploads, milestones, and linked tasks. Reuses the task system from Phase 2 and adds Supabase Storage for file management.

---

## Prerequisites

- Phase 2 (Tasks) is complete and working.
- The tasks table and service exist — projects will link to tasks via a junction table.
- All existing patterns (routes/models/services/features) are established.

---

## Database (Supabase Migration)

Create `supabase/migrations/003_projects.sql`:

### Tables

```sql
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',  -- 'planning', 'active', 'on_hold', 'completed', 'archived'
  budget NUMERIC,
  currency TEXT DEFAULT 'ILS',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_tasks (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, task_id)
);

CREATE TABLE project_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,  -- 'materials', 'labor', 'services', 'equipment', 'other'
  date DATE DEFAULT CURRENT_DATE,
  receipt_file_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- Supabase Storage path
  file_type TEXT,  -- 'contract', 'receipt', 'document', 'image', 'other'
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

```sql
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_task_id ON project_tasks(task_id);
CREATE INDEX idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_project_milestones_project_id ON project_milestones(project_id);
```

### RLS Policies

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own project tasks" ON project_tasks
  FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own expenses" ON project_expenses
  FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own files" ON project_files
  FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own milestones" ON project_milestones
  FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
```

### Trigger

```sql
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Supabase Storage Bucket

Create a storage bucket named `project-files` in Supabase dashboard (or via SQL):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false);

CREATE POLICY "Users can upload to own project folders" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own project files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own project files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

File storage path convention: `{user_id}/{project_id}/{filename}`

---

## Backend

### Models — `backend/app/models/projects.py`

Pydantic models:

- `ProjectCreate(name, description?, budget?, currency?, start_date?, end_date?)`
- `ProjectUpdate(name?, description?, status?, budget?, currency?, start_date?, end_date?)` — all optional
- `ProjectResponse(id, user_id, name, description, status, budget, currency, start_date, end_date, created_at, updated_at)`
- `ProjectDashboardResponse` — extends ProjectResponse with: `total_spent: float`, `task_count: int`, `task_done_count: int`, `upcoming_milestones: list[MilestoneResponse]`, `expense_by_category: dict[str, float]`
- `ExpenseCreate(description, amount, category?, date?, receipt_file_id?)`
- `ExpenseUpdate(description?, amount?, category?, date?)` — all optional
- `ExpenseResponse(id, project_id, description, amount, category, date, receipt_file_id, created_at)`
- `FileResponse(id, project_id, name, file_path, file_type, file_size, mime_type, uploaded_at)`
- `MilestoneCreate(title, description?, target_date?)`
- `MilestoneUpdate(title?, description?, target_date?, completed_at?)` — all optional
- `MilestoneResponse(id, project_id, title, description, target_date, completed_at, sort_order, created_at)`
- `BudgetSummaryResponse(budget, total_spent, remaining, expense_by_category: dict[str, float])`

Validate: `status` in `['planning', 'active', 'on_hold', 'completed', 'archived']`, `amount > 0`.

### Service — `backend/app/services/projects.py`

Class `ProjectService`:

**Project CRUD:**
- `get_projects(user_id)` — list all projects with summary stats (task count, spent amount)
- `get_project(project_id, user_id)` — single project
- `get_project_dashboard(project_id, user_id)` — aggregated: total spent, task progress, upcoming milestones, expense breakdown
- `create_project(user_id, payload)` / `update_project(...)` / `delete_project(...)`

**Task linking:**
- `link_task(project_id, task_id, user_id)` — add existing task to project
- `unlink_task(project_id, task_id, user_id)` — remove task from project
- `get_project_tasks(project_id, user_id)` — list linked tasks

**Expenses:**
- `get_expenses(project_id, user_id)` — list expenses for a project
- `create_expense(project_id, user_id, payload)` / `update_expense(...)` / `delete_expense(...)`
- `get_budget_summary(project_id, user_id)` — budget vs. spent breakdown

**Files:**
- `upload_file(project_id, user_id, file, file_type)` — upload to Supabase Storage at `{user_id}/{project_id}/{uuid}_{filename}`, create row in project_files
- `get_files(project_id, user_id)` — list files
- `get_file_url(file_id, user_id)` — generate a signed URL for downloading
- `delete_file(file_id, user_id)` — delete from Storage + DB

**Milestones:**
- `get_milestones(project_id, user_id)` — list ordered by sort_order
- `create_milestone(project_id, user_id, payload)` / `update_milestone(...)` / `delete_milestone(...)`

### Routes — `backend/app/api/v1/routes/projects.py`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects` | List all projects |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects/{id}` | Get project |
| PATCH | `/api/v1/projects/{id}` | Update project |
| DELETE | `/api/v1/projects/{id}` | Delete project |
| GET | `/api/v1/projects/{id}/dashboard` | Aggregated dashboard data |
| GET | `/api/v1/projects/{id}/tasks` | List linked tasks |
| POST | `/api/v1/projects/{id}/tasks/{task_id}` | Link task to project |
| DELETE | `/api/v1/projects/{id}/tasks/{task_id}` | Unlink task |
| GET | `/api/v1/projects/{id}/expenses` | List expenses |
| POST | `/api/v1/projects/{id}/expenses` | Add expense |
| PATCH | `/api/v1/projects/expenses/{id}` | Update expense |
| DELETE | `/api/v1/projects/expenses/{id}` | Delete expense |
| GET | `/api/v1/projects/{id}/budget-summary` | Budget breakdown |
| GET | `/api/v1/projects/{id}/files` | List files |
| POST | `/api/v1/projects/{id}/files` | Upload file (multipart) |
| GET | `/api/v1/projects/files/{id}/url` | Get signed download URL |
| DELETE | `/api/v1/projects/files/{id}` | Delete file |
| GET | `/api/v1/projects/{id}/milestones` | List milestones |
| POST | `/api/v1/projects/{id}/milestones` | Add milestone |
| PATCH | `/api/v1/projects/milestones/{id}` | Update milestone |
| DELETE | `/api/v1/projects/milestones/{id}` | Delete milestone |

### Register router

In `backend/app/main.py`:
```python
from app.api.v1.routes.projects import router as projects_router
app.include_router(projects_router, prefix="/api/v1")
```

---

## Frontend

### Types — `frontend/src/types/projects.ts`

Mirror backend models: `Project`, `ProjectDashboard`, `Expense`, `ProjectFile`, `Milestone`, `BudgetSummary`, and all create/update payloads.

### API + Hooks — `frontend/src/features/projects/`

- `api.ts` — wrap all project endpoints
- `useProjectHooks.ts` — TanStack Query hooks for all operations

### Pages

**`/projects`** — Projects dashboard
- Cards grid showing each project: name, status badge, progress bar (tasks done / total), budget usage bar, date range
- "+" button to create new project

**`/projects/:id`** — Project detail with tab navigation
- **Overview tab**: status, dates, progress ring chart, budget bar, next 3 upcoming milestones
- **Tasks tab**: list of linked tasks (reuse TaskCard from Phase 2), "Link existing task" button (opens task picker dialog), "Create new task" button
- **Budget tab**: expense list, add expense form, pie chart by category (use a lightweight chart lib like `recharts`), budget vs. spent summary card
- **Files tab**: file grid/list, drag-and-drop upload zone, file type icon, download/delete buttons, preview for images
- **Timeline tab**: vertical milestone timeline, each milestone shows title, target date, completion status, add milestone button

### New components

- `ProjectCard` — dashboard card with status, progress, budget indicators
- `ExpenseForm` — form for adding/editing expenses
- `ExpenseRow` — single expense row with category, amount, date, receipt link
- `BudgetChart` — pie/bar chart (install `recharts` as dependency)
- `FileUploader` — drag-and-drop zone using native `<input type="file">`
- `FileCard` — file thumbnail/icon with name, size, type, download button
- `MilestoneTimeline` — vertical timeline component with milestone markers
- `MilestoneForm` — form for adding/editing milestones
- `TaskPicker` — dialog to search and select existing tasks to link

### New UI components

- `Progress.tsx` — progress bar component
- `TabsNav.tsx` — horizontal tab navigation (different from the segmented ViewToggle in Phase 2 — this is a standard tab bar for page sections)

### New npm dependencies

- `recharts` — for budget charts (pie chart, bar chart)

### Sidebar update

Add "Projects" nav item:
```typescript
import { ShoppingCart, CheckSquare, FolderKanban, X } from "lucide-react";

const navItems = [
  { to: "/shopping", label: "Shopping Lists", icon: ShoppingCart },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
];
```

### App.tsx route registration

```tsx
<Route path="/projects" element={<ProjectsPage />} />
<Route path="/projects/:id" element={<ProjectDetailPage />} />
```

---

## Testing Checklist

- [ ] Create, edit, delete projects
- [ ] Project dashboard shows correct aggregated data
- [ ] Link and unlink tasks to a project
- [ ] Add, edit, delete expenses
- [ ] Budget summary calculates correctly
- [ ] Upload files (test various types: PDF, image, document)
- [ ] Download file via signed URL
- [ ] Delete file removes from Storage + DB
- [ ] Add, edit, complete, delete milestones
- [ ] Timeline renders milestones in order
- [ ] Pie chart shows expense breakdown by category
- [ ] Mobile responsive: tabs work on small screens
