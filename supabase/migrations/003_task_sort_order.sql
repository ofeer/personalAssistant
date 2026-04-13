-- Add sort_order column to tasks for drag-and-drop reordering
ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0;
CREATE INDEX idx_tasks_sort_order ON tasks(user_id, sort_order);
