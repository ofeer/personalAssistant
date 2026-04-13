# Planned Features

## Shopping List

- [ ] **AI-powered category ordering** — When a user adds items to a shopping list without specifying a category or type, they can press an "Order by Category" button and the AI will automatically categorize and reorder the items.

## Task Reminders

- [ ] **Background reminder job** — An asyncio background task running inside the FastAPI lifespan that polls every 60 seconds for due reminders and processes them.

- [ ] **Reminder delivery (v1 — logging)** — Initially, fired reminders are logged server-side to prove the pipeline works end-to-end.

- [ ] **Reminder delivery (v2 — browser push)** — Upgrade delivery to Web Push API notifications. Requires a frontend Service Worker, VAPID key pair on the backend, and a `NotificationPermission` component that asks for browser permission. Notifications arrive even when the tab is closed.

- [ ] **Reminder delivery (v3 — Telegram)** — Once Phase 5 (Telegram) is connected, the reminder job also sends a Telegram message to users with a linked account.

- [ ] **Daily summary notification** — A morning push/Telegram notification summarizing today's tasks: overdue count, due today, and upcoming.

### How it works

1. **User creates a reminder** — picks a date/time via the `ReminderPicker` on a task's detail page. Backend inserts a row into `task_reminders` with `is_sent = false`.
2. **Background loop** — every 60 seconds the job queries `task_reminders WHERE remind_at <= now() AND is_sent = false` (uses a partial index for efficiency). For each match it processes the reminder and sets `is_sent = true`.
3. **Delivery** — evolves through v1 (log) → v2 (browser push) → v3 (Telegram).

### Database table

```sql
CREATE TABLE task_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'push',  -- 'push', 'email'
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_reminders_remind_at
  ON task_reminders(remind_at) WHERE NOT is_sent;
```


## batching all commands
batch get delete remove add update if possible