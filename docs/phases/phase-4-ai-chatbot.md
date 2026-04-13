# Phase 4: AI Chatbot (OpenAI)

## Overview

A conversational AI chatbot that lets users interact with app features (shopping lists, tasks) via natural language. Uses OpenAI GPT-4o-mini with function calling (tools API). The bot understands intent, extracts parameters via structured tool calls, and delegates actions to the existing backend services.

---

## Prerequisites

- Phases 1-2 are complete and working (shopping lists, tasks).
- An OpenAI API key is configured in `.env` (`OPENAI_API_KEY`).
- All existing services (ShoppingService, TaskService) are available for the chatbot to call.

---

## Architecture

```
User message
  → FastAPI /chat/message endpoint
  → Build messages array (system prompt + chat history + user message)
  → Call OpenAI chat.completions.create(messages, tools)
  → If tool_calls in response:
       → Execute each tool via existing service (resolve names to IDs)
       → Send tool results back to OpenAI
       → OpenAI produces natural-language summary
  → Store all messages in chat_messages table
  → Return response to frontend
```

The chatbot does NOT get its own data layer — it delegates all actions to the existing services via OpenAI function calling. This means any validation, ownership checks, and business logic are already handled.

---

## Database (Supabase Migration)

Create `supabase/migrations/004_chat.sql`:

```sql
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,  -- 'user', 'assistant'
  content TEXT NOT NULL,
  actions JSONB,  -- executed actions and their results, null if no actions
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat messages" ON chat_messages
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## Backend

### Config update

Add to `backend/app/core/config.py` Settings:
```python
openai_api_key: str = ""
openai_model: str = "gpt-4o-mini"
```

Add to `.env`:
```
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
```

### Models — `backend/app/models/chat.py`

```python
class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class ChatAction(BaseModel):
    type: str  # 'add_shopping_item', 'create_task', 'add_expense', etc.
    params: dict
    result: dict | None = None
    success: bool = True
    error: str | None = None

class ChatMessageResponse(BaseModel):
    id: str
    role: str  # always 'assistant' in response
    content: str  # the LLM's text response
    actions: list[ChatAction] | None
    created_at: datetime

class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
```

### Service — `backend/app/services/chat.py`

Class `ChatService`:

**Core flow — `send_message(user_id, message)`:**
1. Store user message in chat_messages
2. Load last 20 messages for context
3. Build the prompt (see System Prompt below)
4. Call Ollama API: `POST {ollama_url}/api/chat` with messages array
5. Parse the LLM response:
   - Look for a JSON code block with action instructions
   - If found, extract action type + params
   - Execute action by calling the appropriate service method
   - Collect the result
6. Store assistant message (with actions if any) in chat_messages
7. Return the response

**Action execution — `execute_action(user_id, action_type, params)`:**

Map action types to service calls:

| Action Type | Service Call |
|-------------|-------------|
| `add_shopping_item` | `ShoppingService.add_item(list_id, user_id, payload)` |
| `create_shopping_list` | `ShoppingService.create_list(user_id, payload)` |
| `check_shopping_item` | `ShoppingService.update_item(item_id, user_id, {is_checked: True})` |
| `create_task` | `TaskService.create_task(user_id, payload)` |
| `complete_task` | `TaskService.update_task(task_id, user_id, {status: 'done'})` |
| `create_task_group` | `TaskService.create_group(user_id, payload)` |
| `create_project` | `ProjectService.create_project(user_id, payload)` |
| `add_expense` | `ProjectService.create_expense(project_id, user_id, payload)` |
| `add_milestone` | `ProjectService.create_milestone(project_id, user_id, payload)` |
| `get_daily_summary` | `TaskService.get_daily_summary(user_id)` |
| `get_shopping_lists` | `ShoppingService.get_lists(user_id)` |
| `get_projects` | `ProjectService.get_projects(user_id)` |

If the LLM asks for a list_id, task_id, or project_id that the user hasn't specified, the chatbot should first query the user's data to find matches by name.

**OpenAI client — `backend/app/services/ai/openai_client.py`:**
- Use `openai.AsyncOpenAI` to call OpenAI API
- `chat.completions.create(model, messages, tools)` with function calling
- Handle timeouts (30s), rate limits, and API errors gracefully

**Other methods:**
- `get_history(user_id, limit=50)` — paginated chat history
- `clear_history(user_id)` — delete all messages

### System Prompt

The system prompt should:
1. Describe the bot's personality (helpful personal assistant)
2. List available actions with their parameter schemas
3. Instruct the LLM to respond with a JSON code block when an action is needed
4. Tell the LLM to ask clarifying questions when parameters are ambiguous
5. Tell the LLM to respond conversationally when no action is needed

Example system prompt structure:
```
You are a helpful personal assistant. You can help manage shopping lists, tasks, and projects.

When the user wants to perform an action, respond with your message AND include a JSON action block:

```json
{"action": "create_task", "params": {"title": "Buy groceries", "priority": 2, "due_date": "2025-01-15"}}
```

Available actions:
- add_shopping_item: params {list_name: string, name: string, amount?: number, unit?: string}
- create_shopping_list: params {name: string}
- create_task: params {title: string, description?: string, priority?: 0-4, due_date?: YYYY-MM-DD, group_name?: string}
- complete_task: params {title: string}
- add_expense: params {project_name: string, description: string, amount: number, category?: string}
...

If you're unsure which list/task/project the user means, ask for clarification.
Today's date is {today}.
```

### Routes — `backend/app/api/v1/routes/chat.py`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat/message` | Send message, get response |
| GET | `/api/v1/chat/history` | Get chat history (query: `limit`) |
| DELETE | `/api/v1/chat/history` | Clear chat history |

### Register router

In `backend/app/main.py`:
```python
from app.api.v1.routes.chat import router as chat_router
app.include_router(chat_router, prefix="/api/v1")
```

### New pip dependency

Add to `requirements.txt`:
- `openai>=1.60.0`

---

## Frontend

### Types — `frontend/src/types/chat.ts`

```typescript
interface ChatAction {
  type: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: ChatAction[] | null;
  created_at: string;
}
```

### API + Hooks — `frontend/src/features/chat/`

- `api.ts` — `sendMessage(message)`, `getHistory(limit)`, `clearHistory()`
- `useChatHooks.ts`:
  - `useChatHistory()` — query for message history
  - `useSendMessage()` — mutation that sends message and appends to history
  - `useClearHistory()` — mutation to clear

### Chat UI — `frontend/src/features/chat/`

**ChatWidget** — the main chat interface, accessible from every page:

- **Floating button**: bottom-right corner, circular button with a chat icon (MessageCircle from lucide-react)
- **Chat panel**: slides up from the bottom on mobile (full-screen minus header), slides in from the right on desktop (fixed-width panel)
- **Message list**: scrollable, auto-scroll to bottom on new messages
  - User messages: right-aligned, primary color bubble
  - Assistant messages: left-aligned, muted color bubble
  - Action result cards: inline cards below assistant messages showing what action was performed (e.g., "Added 'Milk x2' to Weekly Groceries" with a link to the list)
- **Input area**: text input + send button at bottom, Enter to send, Shift+Enter for newline
- **Loading state**: typing indicator dots while waiting for LLM response
- **Clear button**: in chat header, to clear history
- **Error state**: if Ollama is unavailable, show a friendly error message

### Components

- `ChatToggleButton` — floating action button to open/close chat
- `ChatPanel` — the sliding panel container
- `ChatMessageBubble` — single message bubble (user or assistant)
- `ChatActionCard` — card showing an executed action and its result
- `ChatInput` — text input with send button
- `TypingIndicator` — three animated dots

### Integration into App

The ChatWidget should be rendered at the top level inside `App.tsx` (inside `ToastProvider`, outside `Routes`), so it's accessible from any page:

```tsx
<ToastProvider>
  <Routes>...</Routes>
  <ChatWidget />
</ToastProvider>
```

---

## Testing Checklist

- [ ] Chat panel opens/closes correctly on mobile and desktop
- [ ] User can send a message and receive a response
- [ ] Handle Ollama being unavailable (show error, don't crash)
- [ ] "Add milk to my shopping list" → correctly identifies list, adds item
- [ ] "Create a task: call dentist tomorrow, high priority" → creates task with correct fields
- [ ] "How many tasks do I have today?" → returns daily summary
- [ ] Chat history persists across page refreshes
- [ ] Clear history works
- [ ] Action result cards show correct info with links
- [ ] Long messages render correctly with scrolling
- [ ] Multiple actions in one conversation maintain context
