DO $$
DECLARE
  v_user_id UUID;
  v_grp_work UUID;
  v_grp_personal UUID;
  v_grp_home UUID;
  v_task_project UUID;
  v_task_overdue1 UUID;
  v_task_today1 UUID;
  v_task_week1 UUID;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'mintz.ofeer@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User mintz.ofeer@gmail.com not found in auth.users';
  END IF;

  -- ── Task Groups ───────────────────────────────────────────────

  INSERT INTO task_groups (user_id, name, color, sort_order)
    VALUES (v_user_id, 'Work', '#3b82f6', 0)
    RETURNING id INTO v_grp_work;

  INSERT INTO task_groups (user_id, name, color, sort_order)
    VALUES (v_user_id, 'Personal', '#10b981', 1)
    RETURNING id INTO v_grp_personal;

  INSERT INTO task_groups (user_id, name, color, sort_order)
    VALUES (v_user_id, 'Home', '#f59e0b', 2)
    RETURNING id INTO v_grp_home;

  -- ── Overdue tasks (past due, not done) ────────────────────────

  INSERT INTO tasks (user_id, group_id, title, description, priority, status, due_date)
    VALUES (v_user_id, v_grp_work, 'Submit quarterly report', 'Finance team needs it ASAP', 4, 'todo', CURRENT_DATE - 3)
    RETURNING id INTO v_task_overdue1;

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date)
    VALUES (v_user_id, v_grp_personal, 'Renew gym membership', 2, 'todo', CURRENT_DATE - 1);

  -- ── Tasks due today ───────────────────────────────────────────

  INSERT INTO tasks (user_id, group_id, title, description, priority, status, due_date, due_time)
    VALUES (v_user_id, v_grp_work, 'Prepare presentation slides', 'For the 3pm meeting', 3, 'in_progress', CURRENT_DATE, '14:00')
    RETURNING id INTO v_task_today1;

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date, recurrence)
    VALUES (v_user_id, v_grp_personal, 'Morning run', 1, 'todo', CURRENT_DATE, 'daily');

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date)
    VALUES (v_user_id, v_grp_home, 'Call plumber about leak', 3, 'todo', CURRENT_DATE);

  -- ── Tasks due this week ───────────────────────────────────────

  INSERT INTO tasks (user_id, group_id, title, description, priority, status, due_date, recurrence)
    VALUES (v_user_id, v_grp_work, 'Weekly team standup notes', 'Summarize action items', 2, 'todo', CURRENT_DATE + 2, 'weekly')
    RETURNING id INTO v_task_week1;

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date)
    VALUES (v_user_id, v_grp_home, 'Fix bathroom shelf', 1, 'todo', CURRENT_DATE + 3);

  INSERT INTO tasks (user_id, title, priority, status, due_date)
    VALUES (v_user_id, 'Dentist appointment', 2, 'todo', CURRENT_DATE + 5);

  -- ── Tasks due later ───────────────────────────────────────────

  INSERT INTO tasks (user_id, group_id, title, description, priority, status, due_date)
    VALUES (v_user_id, v_grp_work, 'Plan Q3 roadmap', 'Draft OKRs and present to leadership', 3, 'todo', CURRENT_DATE + 14)
    RETURNING id INTO v_task_project;

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date)
    VALUES (v_user_id, v_grp_personal, 'Book summer vacation flights', 1, 'todo', CURRENT_DATE + 21);

  -- ── Completed tasks ───────────────────────────────────────────

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date, completed_at)
    VALUES (v_user_id, v_grp_work, 'Review PR #142', 2, 'done', CURRENT_DATE - 2, NOW() - INTERVAL '2 days');

  INSERT INTO tasks (user_id, group_id, title, priority, status, due_date, completed_at)
    VALUES (v_user_id, v_grp_home, 'Assemble IKEA bookshelf', 0, 'done', CURRENT_DATE - 5, NOW() - INTERVAL '4 days');

  -- ── Subtasks (under "Plan Q3 roadmap") ────────────────────────

  INSERT INTO tasks (user_id, parent_task_id, title, priority, status) VALUES
    (v_user_id, v_task_project, 'Gather team input on priorities', 0, 'done'),
    (v_user_id, v_task_project, 'Draft OKR document', 0, 'in_progress'),
    (v_user_id, v_task_project, 'Schedule review meeting with leads', 0, 'todo'),
    (v_user_id, v_task_project, 'Finalize and share with leadership', 0, 'todo');

  -- ── Reminders ─────────────────────────────────────────────────

  -- Already sent (overdue task had a reminder yesterday)
  INSERT INTO task_reminders (task_id, remind_at, type, is_sent)
    VALUES (v_task_overdue1, NOW() - INTERVAL '1 day', 'push', true);

  -- Due soon (today's presentation, remind in the next hour)
  INSERT INTO task_reminders (task_id, remind_at, type, is_sent)
    VALUES (v_task_today1, NOW() + INTERVAL '1 hour', 'push', false);

  -- Future (weekly standup notes, remind the morning of)
  INSERT INTO task_reminders (task_id, remind_at, type, is_sent)
    VALUES (v_task_week1, (CURRENT_DATE + 2 + TIME '08:00')::timestamptz, 'push', false);

END $$;
