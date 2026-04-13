-- Task Manager tables, indexes, RLS policies

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
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'todo',
  due_date DATE,
  due_time TIME,
  recurrence TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE task_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'push',
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_groups_user_id ON task_groups(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_group_id ON tasks(group_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_due_date ON tasks(user_id, due_date);
CREATE INDEX idx_tasks_status ON tasks(user_id, status);
CREATE INDEX idx_task_reminders_remind_at ON task_reminders(remind_at) WHERE NOT is_sent;

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

-- Reuse update_updated_at() from migration 001
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
