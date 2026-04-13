# AI Chatbot Design Spec

## Overview

A conversational AI chatbot integrated into the personal management app, powered by **OpenAI GPT-4o-mini** with **function calling**. The bot manages shopping lists and tasks through natural language. It delegates all actions to existing backend services (`ShoppingService`, `TaskService`).

Phase 3 (Projects) is skipped -- the chatbot scopes to shopping + tasks only.

## Architecture

```
User message
  -> POST /api/v1/chat/message
  -> ChatService.send_message()
  -> Load last 20 messages from chat_messages table
  -> Build messages array (system prompt + history + user message)
  -> Call OpenAI chat.completions.create(messages, tools)
  -> If tool_calls in response:
       -> Execute each tool via existing service (resolve names to IDs)
       -> Send tool results back to OpenAI
       -> OpenAI produces natural-language summary
  -> Store all messages in chat_messages table
  -> Return response to frontend
```

Multi-tool loop: OpenAI may return multiple tool calls in one response (e.g. "add milk and eggs" = 2 calls). The executor processes all of them, sends all results back, and gets a final summary.

### File Structure

```
backend/app/
  services/
    ai/
      __init__.py
      openai_client.py    # OpenAI API wrapper
      tools.py            # Tool definitions + executor mapping
      prompts.py          # System prompt template
    chat.py               # ChatService orchestration
  models/
    chat.py               # Pydantic request/response models
  api/v1/routes/
    chat.py               # REST endpoints

frontend/src/
  features/chat/
    api.ts                # API calls
    useChatHooks.ts       # TanStack Query hooks
    ChatWidget.tsx        # Top-level wrapper (button + panel)
    ChatToggleButton.tsx  # Floating action button
    ChatPanel.tsx         # Slide panel container
    ChatMessageBubble.tsx # Message bubble component
    ChatActionCard.tsx    # Action result card
    ChatInput.tsx         # Text input + send
    TypingIndicator.tsx   # Animated dots
  types/
    chat.ts               # TypeScript interfaces
```

## Backend

### Config

Add to `backend/app/core/config.py`:

```python
openai_api_key: str
openai_model: str = "gpt-4o-mini"
```

Environment variables in `.env`:

```
OPENAI_API_KEY=<key>
OPENAI_MODEL=gpt-4o-mini
```

### New Dependency

Add `openai` to `backend/requirements.txt`.

### Database Migration

Create `supabase/migrations/005_chat.sql`:

```sql
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,          -- 'user', 'assistant', 'tool'
  content TEXT NOT NULL,
  tool_calls JSONB,            -- OpenAI tool_calls array (assistant messages)
  tool_call_id TEXT,           -- For tool result messages
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat" ON chat_messages
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Fields `tool_calls` and `tool_call_id` are stored so the full conversation can be reconstructed for OpenAI's API (tool results must reference their tool_call_id).

### Models (`backend/app/models/chat.py`)

```python
class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class ChatAction(BaseModel):
    tool_name: str
    params: dict
    result: dict | None = None
    success: bool = True
    error: str | None = None

class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    actions: list[ChatAction] | None
    created_at: datetime

class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
```

### OpenAI Client (`backend/app/services/ai/openai_client.py`)

Thin wrapper around the `openai` Python package:

- Initialize `AsyncOpenAI(api_key=settings.openai_api_key)`
- `chat_completion(messages, tools)` -> calls `client.chat.completions.create(model, messages, tools)`
- Timeout: 30 seconds (GPT-4o-mini is fast, unlike local Ollama)
- Error handling: connection errors, rate limits, invalid API key

### Tool Definitions (`backend/app/services/ai/tools.py`)

Each tool is defined as an OpenAI function schema and mapped to a service method.

**Shopping tools:**

| Tool Name | Params | Service Call |
|-----------|--------|-------------|
| `get_shopping_lists` | (none) | `ShoppingService.get_lists(user_id)` |
| `get_shopping_list_detail` | `list_name: str` | Resolve name -> ID, then `ShoppingService.get_list(list_id, user_id)` |
| `create_shopping_list` | `name: str` | `ShoppingService.create_list(user_id, payload)` |
| `add_shopping_item` | `list_name: str, name: str, amount?: number, unit?: str` | Resolve list name -> ID, then `ShoppingService.add_item(list_id, user_id, payload)` |
| `remove_shopping_item` | `list_name: str, item_name: str` | Resolve both names -> IDs, then `ShoppingService.delete_item(item_id, user_id)` |
| `check_shopping_item` | `list_name: str, item_name: str, checked: bool` | Resolve names -> IDs, then `ShoppingService.update_item(item_id, user_id, payload)` |
| `check_all_items` | `list_name: str, checked: bool` | Resolve name -> ID, then `ShoppingService.check_all(list_id, user_id, payload)` |

**Task tools:**

| Tool Name | Params | Service Call |
|-----------|--------|-------------|
| `get_tasks` | `view: str (all/today/week/priority), group_name?: str` | `TaskService.get_tasks(user_id, view, filters)` |
| `get_daily_summary` | (none) | `TaskService.get_daily_summary(user_id)` |
| `create_task` | `title: str, description?: str, priority?: 0-4, due_date?: YYYY-MM-DD, group_name?: str` | Resolve group name if given, `TaskService.create_task(user_id, payload)` |
| `complete_task` | `task_title: str` | Resolve title -> ID, `TaskService.update_task(task_id, user_id, {status: "done"})` |
| `delete_task` | `task_title: str` | Resolve title -> ID, `TaskService.delete_task(task_id, user_id)` |
| `get_task_groups` | (none) | `TaskService.get_groups(user_id)` |

**Cross-feature tools:**

| Tool Name | Params | Service Call |
|-----------|--------|-------------|
| `get_everything_summary` | (none) | Calls `TaskService.get_daily_summary()` + `ShoppingService.get_lists()` |

### Name-to-ID Resolution

Users reference items by name ("my grocery list", "call dentist task"). The tool executor:

1. Queries the user's data by name (case-insensitive partial match)
2. If exactly one match -> use it
3. If multiple matches -> return error message asking AI to clarify with the user
4. If no matches -> return error message telling AI the item wasn't found

### System Prompt (`backend/app/services/ai/prompts.py`)

```
You are a helpful personal assistant for a task and shopping management app.
You help users manage their shopping lists and tasks through natural conversation.

Guidelines:
- Be concise and friendly
- When the user asks to do something, use the available tools
- When a name is ambiguous (multiple matches), ask which one they mean
- For dates, today is {today_date}. Convert relative dates to YYYY-MM-DD format
- You can call multiple tools in one response when appropriate
- After performing actions, briefly confirm what you did
- For queries, summarize data in a readable way
- If you're unsure what the user wants, ask a clarifying question
```

### ChatService (`backend/app/services/chat.py`)

**`send_message(user_id, message)`:**

1. Store user message in `chat_messages` (role='user')
2. Load last 20 messages for context (reconstruct full OpenAI message format including tool roles)
3. Build messages array: system prompt + history + new user message
4. Call OpenAI with tools
5. While response contains tool_calls:
   a. For each tool_call, execute via tool executor
   b. Store assistant message (with tool_calls) in DB
   c. Store each tool result message in DB
   d. Send updated messages to OpenAI
6. Store final assistant text response in DB
7. Return formatted response with action summaries

**`get_history(user_id, limit=50)`:** Paginated chat history, filtering out tool-role messages (only show user + assistant).

**`clear_history(user_id)`:** Delete all messages for user.

### Routes (`backend/app/api/v1/routes/chat.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/chat/message` | Required | Send message, get AI response |
| `GET` | `/api/v1/chat/history` | Required | Get history (`?limit=50`) |
| `DELETE` | `/api/v1/chat/history` | Required | Clear all history |

## Frontend

### Types (`frontend/src/types/chat.ts`)

```typescript
interface IChatAction {
  tool_name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
}

interface IChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: IChatAction[] | null;
  created_at: string;
}
```

### API (`frontend/src/features/chat/api.ts`)

- `sendMessage(message: string)` -> POST `/chat/message`
- `getChatHistory(limit?: number)` -> GET `/chat/history`
- `clearChatHistory()` -> DELETE `/chat/history`

### Hooks (`frontend/src/features/chat/useChatHooks.ts`)

- `useChatHistory()` - TanStack Query for message history
- `useSendMessage()` - mutation, optimistically adds user message, appends response
- `useClearHistory()` - mutation to clear

### UI Components

**ChatWidget** (top-level, rendered in `App.tsx`):
- Manages open/closed state
- Renders `ChatToggleButton` + `ChatPanel`

**ChatToggleButton**:
- Floating circular button, bottom-right corner
- `MessageCircle` icon from lucide-react
- Toggles panel open/closed

**ChatPanel**:
- Mobile: slides up from bottom (full height minus header)
- Desktop: slides in from right (fixed width ~400px)
- Contains header (title + clear button), message list, input

**ChatMessageBubble**:
- User messages: right-aligned, primary color
- Assistant messages: left-aligned, muted color
- Renders markdown-like content (basic formatting)

**ChatActionCard**:
- Shown below assistant messages when actions were executed
- Shows tool name + summary (e.g. "Added 'Milk' to Weekly Groceries")
- Success/error styling

**ChatInput**:
- Text input + send button
- Enter to send, Shift+Enter for newline
- Disabled while waiting for response

**TypingIndicator**:
- Three animated dots shown while waiting for OpenAI response

### Integration

In `App.tsx`, add `<ChatWidget />` at root level:

```tsx
<ToastProvider>
  <Routes>...</Routes>
  <ChatWidget />
</ToastProvider>
```

## Error Handling

- **OpenAI API key invalid**: Return friendly error, log details server-side
- **Rate limited**: Return "I'm a bit busy right now, try again in a moment"
- **Tool execution fails**: Return the error to OpenAI so it can explain what went wrong to the user
- **Name resolution fails**: Return options to OpenAI so it can ask the user to clarify
- **Network timeout**: 30s timeout on OpenAI calls, return error if exceeded

## Testing Checklist

- Chat panel opens/closes correctly on mobile and desktop
- User sends message and receives response
- "Add milk to my grocery list" -> resolves list, adds item
- "Create a task: call dentist tomorrow, high priority" -> creates task with correct fields
- "What do I have today?" -> returns daily summary
- "Check off all items on my grocery list" -> batch check works
- "What's everything on my plate?" -> cross-feature summary
- Multi-turn: "Add a task" -> bot asks for details -> user provides -> task created
- Multiple tool calls: "Add milk and eggs to my list" -> two items added
- Ambiguous names: bot asks for clarification when multiple matches
- Chat history persists across page refreshes
- Clear history works
- Error states: invalid API key, timeout, rate limit
- Action cards show correct info
