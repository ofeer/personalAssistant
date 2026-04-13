-- Task labels for cross-cutting concerns (e.g., urgent, blocked, waiting)

CREATE TABLE task_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE task_label_assignments (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID REFERENCES task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE INDEX idx_task_labels_user_id ON task_labels(user_id);
CREATE INDEX idx_task_label_assignments_task_id ON task_label_assignments(task_id);
CREATE INDEX idx_task_label_assignments_label_id ON task_label_assignments(label_id);

ALTER TABLE task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own labels" ON task_labels
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE task_label_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own label assignments" ON task_label_assignments
  FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));
