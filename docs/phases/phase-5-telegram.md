# Phase 5: Telegram Bot Integration

## Overview

Connect the app to Telegram so users can interact with shopping lists, tasks, and projects from Telegram. Uses the same AI pipeline from Phase 4 for free-text messages, plus explicit slash commands for common actions. Users must link their Telegram account to their web app account.

---

## Prerequisites

- Phase 4 (AI Chatbot) is complete and working.
- A Telegram Bot is created via @BotFather (you'll need the bot token).
- The backend is accessible from the internet (Telegram webhooks require a public URL). Options: ngrok for development, a deployed server for production.
- All existing services (Shopping, Tasks, Projects, Chat) are available.

---

## Architecture

```
Telegram user sends message
  → Telegram API delivers to webhook URL
  → FastAPI POST /api/v1/telegram/webhook
  → Look up user by telegram_chat_id in telegram_links
  → If not linked: guide user through linking flow
  → If linked:
    → If slash command (/shop, /task, /today): parse and execute directly
    → If free text: pass through ChatService.send_message (same as Phase 4)
  → Send response back via Telegram sendMessage API
```

---

## Database (Supabase Migration)

Create `supabase/migrations/005_telegram.sql`:

```sql
CREATE TABLE telegram_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  linked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_telegram_links_chat_id ON telegram_links(telegram_chat_id);
CREATE INDEX idx_telegram_links_user_id ON telegram_links(user_id);
CREATE INDEX idx_telegram_link_codes_user_id ON telegram_link_codes(user_id);

ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own telegram link" ON telegram_links
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own link codes" ON telegram_link_codes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## Backend

### Config update

Add to `backend/app/core/config.py` Settings:
```python
telegram_bot_token: str = ""
telegram_webhook_secret: str = ""  # for webhook verification
```

Add to `.env`:
```
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_WEBHOOK_SECRET=a-random-secret-string
```

### Models — `backend/app/models/telegram.py`

```python
class TelegramLinkResponse(BaseModel):
    code: str
    expires_at: datetime

class TelegramLinkStatus(BaseModel):
    linked: bool
    telegram_username: str | None
    linked_at: datetime | None
```

Note: Telegram webhook payloads should be parsed from raw JSON — use Telegram's Update model structure (or a lightweight custom parser). Avoid pulling in the full `python-telegram-bot` library as a dependency to keep it lean; use `httpx` to call Telegram's Bot API directly.

### Service — `backend/app/services/telegram.py`

Class `TelegramService`:

**Account linking:**
- `generate_link_code(user_id)` — create a 6-digit code in telegram_link_codes, expires in 10 minutes, return the code
- `verify_link_code(code, telegram_chat_id, telegram_username)` — find the code, check not expired, create telegram_links row, delete the code
- `get_link_status(user_id)` — check if user has a linked Telegram account
- `unlink(user_id)` — delete from telegram_links
- `get_user_id_by_chat_id(telegram_chat_id)` — look up the linked web app user_id

**Message handling:**
- `handle_update(update)` — main entry point for webhook updates:
  1. Extract chat_id, text, username from the Telegram update
  2. Look up user_id via `get_user_id_by_chat_id`
  3. If not linked:
     - If text starts with `/start ` followed by a code: attempt `verify_link_code`
     - Otherwise: send message explaining how to link
  4. If linked: route to command handler or AI chat

**Command handlers:**
- `/start` — welcome message + linking instructions
- `/start {code}` — link account using code
- `/shop {item}` — quick add item to the user's most recent shopping list (e.g., `/shop Milk 2L`)
- `/task {title}` — quick create task (e.g., `/task Call dentist tomorrow`)
- `/today` — show today's task summary
- `/lists` — show shopping lists summary
- `/projects` — show projects summary
- `/help` — show available commands
- Any other text → pass through `ChatService.send_message` (the AI pipeline)

**Telegram API client — `backend/app/services/telegram_api.py`:**
- Use `httpx.AsyncClient` to call `https://api.telegram.org/bot{token}/`
- `send_message(chat_id, text, parse_mode='Markdown')` — send a message
- `set_webhook(url, secret_token)` — register webhook URL with Telegram

### Routes — `backend/app/api/v1/routes/telegram.py`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/telegram/webhook` | Telegram webhook handler (no auth — verified by secret header) |
| POST | `/api/v1/telegram/link` | Generate a link code (requires auth) |
| GET | `/api/v1/telegram/link` | Get link status (requires auth) |
| DELETE | `/api/v1/telegram/link` | Unlink Telegram account (requires auth) |
| POST | `/api/v1/telegram/setup-webhook` | One-time: register webhook URL with Telegram (admin/manual) |

**Webhook security:**
Telegram sends `X-Telegram-Bot-Api-Secret-Token` header — verify it matches `telegram_webhook_secret` from config. The webhook endpoint does NOT use `get_current_user` (it's called by Telegram, not by a logged-in user).

### Register router

In `backend/app/main.py`:
```python
from app.api.v1.routes.telegram import router as telegram_router
app.include_router(telegram_router, prefix="/api/v1")
```

---

## Frontend

The frontend changes for this phase are minimal — just a settings page for account linking.

### Settings/Account page — `frontend/src/features/settings/TelegramLinkPage.tsx`

Add a settings or account page (or a section in an existing profile page):

- **Link status**: shows "Linked to @username" or "Not linked"
- **Link button**: generates a 6-digit code and shows instructions:
  1. Open Telegram
  2. Search for @YourBotName
  3. Send: `/start {code}`
  4. Code expires in 10 minutes
- **Unlink button**: removes the link (with confirmation)
- Auto-refresh link status every 5 seconds while a code is active (to detect when linking completes)

### API + Hooks

- `frontend/src/features/settings/telegramApi.ts` — `generateLinkCode()`, `getLinkStatus()`, `unlinkTelegram()`
- `frontend/src/features/settings/useTelegramLink.ts` — hooks wrapping the API calls

### Sidebar update

Add "Settings" nav item:
```typescript
import { ShoppingCart, CheckSquare, FolderKanban, Settings, X } from "lucide-react";

const navItems = [
  { to: "/shopping", label: "Shopping Lists", icon: ShoppingCart },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/settings", label: "Settings", icon: Settings },
];
```

### App.tsx route registration

```tsx
<Route path="/settings" element={<TelegramLinkPage />} />
```

---

## Telegram Bot Setup Steps

1. Message @BotFather on Telegram: `/newbot`
2. Choose a name and username for your bot
3. Copy the bot token to `.env` as `TELEGRAM_BOT_TOKEN`
4. Generate a random string for `TELEGRAM_WEBHOOK_SECRET`
5. Deploy backend (or use ngrok for dev)
6. Call the setup-webhook endpoint: `POST /api/v1/telegram/setup-webhook` with `{ "url": "https://your-domain/api/v1/telegram/webhook" }`
7. Test by messaging the bot on Telegram

---

## Testing Checklist

- [ ] Generate link code from web UI
- [ ] Link Telegram account by sending `/start {code}` to bot
- [ ] Link status updates in web UI
- [ ] Unlink account works
- [ ] Expired codes are rejected
- [ ] `/shop Milk 2L` adds item to most recent list
- [ ] `/task Call dentist tomorrow` creates a task
- [ ] `/today` returns today's task summary
- [ ] `/lists` shows shopping lists
- [ ] `/projects` shows projects
- [ ] `/help` shows all available commands
- [ ] Free text message ("add eggs to my grocery list") goes through AI and works
- [ ] Bot responds with Markdown-formatted messages
- [ ] Unknown users get linking instructions
- [ ] Webhook rejects requests without valid secret token
- [ ] Bot handles errors gracefully (returns friendly messages)
