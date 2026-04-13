# AI Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conversational AI chatbot powered by OpenAI GPT-4o-mini with function calling, enabling users to manage tasks and shopping lists via natural language.

**Architecture:** The chatbot uses OpenAI's function calling (tools) API. Each user action (add task, check shopping item, etc.) is defined as a tool with a JSON schema. The ChatService orchestrates: load history, call OpenAI, execute tool calls via existing services, send results back, return the final response. Frontend renders a floating chat widget accessible from every page.

**Tech Stack:** Python/FastAPI, `openai` SDK, Supabase (Postgres), React 19, TanStack Query, Tailwind CSS, lucide-react

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/005_chat.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/005_chat.sql
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  tool_call_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat" ON chat_messages
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration**

Run: `cd supabase && supabase db reset` (or apply via Supabase dashboard)
Expected: Table `chat_messages` created successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_chat.sql
git commit -m "feat: add chat_messages table for AI chatbot"
```

---

### Task 2: Backend Config & Dependency

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add OpenAI settings to config**

In `backend/app/core/config.py`, add two fields to the `Settings` class:

```python
class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str
    backend_port: int = 8000
    frontend_url: str = "http://localhost:5173"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}
```

- [ ] **Step 2: Add environment variables to .env**

Add to the root `.env` file:

```
OPENAI_API_KEY=<your-key-here>
OPENAI_MODEL=gpt-4o-mini
```

- [ ] **Step 3: Add openai dependency**

Add to `backend/requirements.txt`:

```
openai==1.82.0
```

Then run:

```bash
cd backend && pip install -r requirements.txt
```

- [ ] **Step 4: Verify config loads**

Run: `cd backend && python -c "from app.core.config import settings; print(settings.openai_model)"`
Expected: `gpt-4o-mini`

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/requirements.txt
git commit -m "feat: add OpenAI config and dependency"
```

---

### Task 3: OpenAI Client Wrapper

**Files:**
- Create: `backend/app/services/ai/__init__.py`
- Create: `backend/app/services/ai/openai_client.py`

- [ ] **Step 1: Create the ai package**

Create `backend/app/services/ai/__init__.py` (empty file).

- [ ] **Step 2: Implement OpenAI client**

Create `backend/app/services/ai/openai_client.py`:

```python
import logging

from openai import AsyncOpenAI, APIConnectionError, RateLimitError, APIStatusError
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionToolParam

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=30.0,
        )
    return _client


async def chat_completion(
    messages: list[ChatCompletionMessageParam],
    tools: list[ChatCompletionToolParam] | None = None,
) -> dict:
    """Call OpenAI chat completions. Returns the response message dict."""
    client = get_openai_client()
    try:
        kwargs: dict = {
            "model": settings.openai_model,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message

    except APIConnectionError:
        logger.error("OpenAI API connection failed")
        raise
    except RateLimitError:
        logger.warning("OpenAI API rate limited")
        raise
    except APIStatusError as exc:
        logger.error("OpenAI API error", {"status": exc.status_code, "message": str(exc)})
        raise
```

- [ ] **Step 3: Verify import works**

Run: `cd backend && python -c "from app.services.ai.openai_client import chat_completion; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/ai/
git commit -m "feat: add OpenAI client wrapper"
```

---

### Task 4: Tool Definitions

**Files:**
- Create: `backend/app/services/ai/tools.py`

- [ ] **Step 1: Create tool definitions file**

Create `backend/app/services/ai/tools.py` with all OpenAI function schemas and the executor mapping:

```python
import json
import logging

from app.models.shopping import ShoppingItemCreate, ShoppingItemUpdate, ShoppingListCreate
from app.models.tasks import TaskCreate, TaskUpdate
from app.services.shopping import ShoppingService
from app.services.tasks import TaskService

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_shopping_lists",
            "description": "Get all of the user's shopping lists with item counts",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shopping_list_detail",
            "description": "Get a specific shopping list with all its items",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_name": {
                        "type": "string",
                        "description": "Name of the shopping list",
                    },
                },
                "required": ["list_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_shopping_list",
            "description": "Create a new shopping list",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for the new shopping list",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_shopping_item",
            "description": "Add an item to a shopping list",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_name": {
                        "type": "string",
                        "description": "Name of the shopping list to add to",
                    },
                    "name": {
                        "type": "string",
                        "description": "Name of the item to add",
                    },
                    "amount": {
                        "type": "number",
                        "description": "Quantity (default 1)",
                    },
                    "unit": {
                        "type": "string",
                        "description": "Unit of measurement (e.g. kg, liters, pieces)",
                    },
                },
                "required": ["list_name", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_shopping_item",
            "description": "Remove an item from a shopping list",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_name": {
                        "type": "string",
                        "description": "Name of the shopping list",
                    },
                    "item_name": {
                        "type": "string",
                        "description": "Name of the item to remove",
                    },
                },
                "required": ["list_name", "item_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_shopping_item",
            "description": "Check or uncheck a shopping item",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_name": {
                        "type": "string",
                        "description": "Name of the shopping list",
                    },
                    "item_name": {
                        "type": "string",
                        "description": "Name of the item",
                    },
                    "checked": {
                        "type": "boolean",
                        "description": "True to check, false to uncheck",
                    },
                },
                "required": ["list_name", "item_name", "checked"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_all_shopping_items",
            "description": "Check or uncheck all items in a shopping list",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_name": {
                        "type": "string",
                        "description": "Name of the shopping list",
                    },
                    "checked": {
                        "type": "boolean",
                        "description": "True to check all, false to uncheck all",
                    },
                },
                "required": ["list_name", "checked"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_tasks",
            "description": "Get the user's tasks. Views: 'all' for everything, 'today' for today and overdue, 'week' for this week, 'priority' sorted by priority",
            "parameters": {
                "type": "object",
                "properties": {
                    "view": {
                        "type": "string",
                        "enum": ["all", "today", "week", "priority"],
                        "description": "Which view to use (default: today)",
                    },
                    "group_name": {
                        "type": "string",
                        "description": "Filter by task group name",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_summary",
            "description": "Get a summary of today's tasks: overdue count, tasks due today, and upcoming tasks",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Task title",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional task description",
                    },
                    "priority": {
                        "type": "integer",
                        "enum": [0, 1, 2, 3, 4],
                        "description": "Priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent",
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Due date in YYYY-MM-DD format",
                    },
                    "group_name": {
                        "type": "string",
                        "description": "Name of the task group to assign to",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a task as done/completed",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "Title of the task to complete",
                    },
                },
                "required": ["task_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task permanently",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "Title of the task to delete",
                    },
                },
                "required": ["task_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_groups",
            "description": "Get all task groups",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_everything_summary",
            "description": "Get a full overview: daily task summary plus all shopping lists with counts",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


async def _resolve_shopping_list_id(
    shopping_service: ShoppingService, user_id: str, list_name: str
) -> str:
    """Find a shopping list ID by name. Raises ValueError if ambiguous or not found."""
    lists = await shopping_service.get_lists(user_id)
    matches = [
        sl for sl in lists if sl["name"].lower() == list_name.lower()
    ]
    if not matches:
        matches = [
            sl for sl in lists if list_name.lower() in sl["name"].lower()
        ]
    if len(matches) == 1:
        return matches[0]["id"]
    if len(matches) > 1:
        names = ", ".join(f'"{m["name"]}"' for m in matches)
        raise ValueError(
            f"Multiple shopping lists match '{list_name}': {names}. Ask the user which one."
        )
    available = ", ".join(f'"{sl["name"]}"' for sl in lists)
    raise ValueError(
        f"No shopping list found matching '{list_name}'. Available lists: {available}"
    )


async def _resolve_shopping_item(
    shopping_service: ShoppingService, user_id: str, list_id: str, item_name: str
) -> str:
    """Find a shopping item ID by name within a list."""
    list_detail = await shopping_service.get_list(list_id, user_id)
    items = list_detail.get("items", [])
    matches = [
        item for item in items if item["name"].lower() == item_name.lower()
    ]
    if not matches:
        matches = [
            item for item in items if item_name.lower() in item["name"].lower()
        ]
    if len(matches) == 1:
        return matches[0]["id"]
    if len(matches) > 1:
        names = ", ".join(f'"{m["name"]}"' for m in matches)
        raise ValueError(
            f"Multiple items match '{item_name}': {names}. Ask the user which one."
        )
    available = ", ".join(f'"{item["name"]}"' for item in items)
    raise ValueError(
        f"No item found matching '{item_name}'. Items in list: {available}"
    )


async def _resolve_task_by_title(
    task_service: TaskService, user_id: str, title: str
) -> str:
    """Find a task ID by title. Searches all non-done tasks."""
    tasks = await task_service.get_tasks(user_id, view="all")
    matches = [
        t for t in tasks if t["title"].lower() == title.lower()
    ]
    if not matches:
        matches = [
            t for t in tasks if title.lower() in t["title"].lower()
        ]
    if len(matches) == 1:
        return matches[0]["id"]
    if len(matches) > 1:
        names = ", ".join(f'"{m["title"]}"' for m in matches)
        raise ValueError(
            f"Multiple tasks match '{title}': {names}. Ask the user which one."
        )
    raise ValueError(f"No task found matching '{title}'.")


async def _resolve_group_by_name(
    task_service: TaskService, user_id: str, group_name: str
) -> str:
    """Find a task group ID by name."""
    groups = await task_service.get_groups(user_id)
    matches = [
        g for g in groups if g["name"].lower() == group_name.lower()
    ]
    if not matches:
        matches = [
            g for g in groups if group_name.lower() in g["name"].lower()
        ]
    if len(matches) == 1:
        return matches[0]["id"]
    if len(matches) > 1:
        names = ", ".join(f'"{m["name"]}"' for m in matches)
        raise ValueError(
            f"Multiple groups match '{group_name}': {names}. Ask the user which one."
        )
    raise ValueError(f"No task group found matching '{group_name}'.")


async def execute_tool(
    tool_name: str,
    arguments: dict,
    user_id: str,
    shopping_service: ShoppingService,
    task_service: TaskService,
) -> dict:
    """Execute a tool call and return the result as a dict."""
    try:
        if tool_name == "get_shopping_lists":
            return {"lists": await shopping_service.get_lists(user_id)}

        elif tool_name == "get_shopping_list_detail":
            list_id = await _resolve_shopping_list_id(
                shopping_service, user_id, arguments["list_name"]
            )
            return await shopping_service.get_list(list_id, user_id)

        elif tool_name == "create_shopping_list":
            payload = ShoppingListCreate(name=arguments["name"])
            return await shopping_service.create_list(user_id, payload)

        elif tool_name == "add_shopping_item":
            list_id = await _resolve_shopping_list_id(
                shopping_service, user_id, arguments["list_name"]
            )
            payload = ShoppingItemCreate(
                name=arguments["name"],
                amount=arguments.get("amount", 1),
                unit=arguments.get("unit"),
            )
            return await shopping_service.add_item(list_id, user_id, payload)

        elif tool_name == "remove_shopping_item":
            list_id = await _resolve_shopping_list_id(
                shopping_service, user_id, arguments["list_name"]
            )
            item_id = await _resolve_shopping_item(
                shopping_service, user_id, list_id, arguments["item_name"]
            )
            await shopping_service.delete_item(item_id, user_id)
            return {"deleted": True, "item_name": arguments["item_name"]}

        elif tool_name == "check_shopping_item":
            list_id = await _resolve_shopping_list_id(
                shopping_service, user_id, arguments["list_name"]
            )
            item_id = await _resolve_shopping_item(
                shopping_service, user_id, list_id, arguments["item_name"]
            )
            payload = ShoppingItemUpdate(is_checked=arguments["checked"])
            return await shopping_service.update_item(item_id, user_id, payload)

        elif tool_name == "check_all_shopping_items":
            list_id = await _resolve_shopping_list_id(
                shopping_service, user_id, arguments["list_name"]
            )
            await shopping_service.check_all_items(list_id, user_id, arguments["checked"])
            return {"checked_all": arguments["checked"], "list_name": arguments["list_name"]}

        elif tool_name == "get_tasks":
            view = arguments.get("view", "today")
            group_id = None
            if arguments.get("group_name"):
                group_id = await _resolve_group_by_name(
                    task_service, user_id, arguments["group_name"]
                )
            tasks = await task_service.get_tasks(
                user_id, view=view, group_id=group_id
            )
            return {"tasks": tasks, "count": len(tasks)}

        elif tool_name == "get_daily_summary":
            return await task_service.get_daily_summary(user_id)

        elif tool_name == "create_task":
            group_id = None
            if arguments.get("group_name"):
                group_id = await _resolve_group_by_name(
                    task_service, user_id, arguments["group_name"]
                )
            payload = TaskCreate(
                title=arguments["title"],
                description=arguments.get("description"),
                priority=arguments.get("priority", 0),
                due_date=arguments.get("due_date"),
                group_id=group_id,
            )
            return await task_service.create_task(user_id, payload)

        elif tool_name == "complete_task":
            task_id = await _resolve_task_by_title(
                task_service, user_id, arguments["task_title"]
            )
            payload = TaskUpdate(status="done")
            return await task_service.update_task(task_id, user_id, payload)

        elif tool_name == "delete_task":
            task_id = await _resolve_task_by_title(
                task_service, user_id, arguments["task_title"]
            )
            await task_service.delete_task(task_id, user_id)
            return {"deleted": True, "task_title": arguments["task_title"]}

        elif tool_name == "get_task_groups":
            return {"groups": await task_service.get_groups(user_id)}

        elif tool_name == "get_everything_summary":
            daily = await task_service.get_daily_summary(user_id)
            lists = await shopping_service.get_lists(user_id)
            return {"daily_summary": daily, "shopping_lists": lists}

        else:
            return {"error": f"Unknown tool: {tool_name}"}

    except ValueError as exc:
        return {"error": str(exc)}
    except Exception as exc:
        logger.error("Tool execution failed", {"tool": tool_name, "error": str(exc)})
        return {"error": f"Failed to execute {tool_name}: {str(exc)}"}
```

- [ ] **Step 2: Verify import works**

Run: `cd backend && python -c "from app.services.ai.tools import TOOL_DEFINITIONS, execute_tool; print(f'{len(TOOL_DEFINITIONS)} tools defined')"`
Expected: `14 tools defined`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/ai/tools.py
git commit -m "feat: add AI tool definitions and executor for shopping/tasks"
```

---

### Task 5: System Prompt

**Files:**
- Create: `backend/app/services/ai/prompts.py`

- [ ] **Step 1: Create prompts module**

Create `backend/app/services/ai/prompts.py`:

```python
from datetime import date


def build_system_prompt() -> str:
    today = date.today().isoformat()
    return f"""You are a helpful personal assistant for a task and shopping management app.
You help users manage their shopping lists and tasks through natural conversation.

Guidelines:
- Be concise and friendly. Keep responses short.
- When the user asks to do something, use the available tools.
- When a name is ambiguous (e.g. "my list" when they have multiple lists), ask which one they mean.
- For dates, today is {today}. Convert relative dates ("tomorrow", "next Monday", etc.) to YYYY-MM-DD format.
- You can call multiple tools in one response when appropriate (e.g. "add milk and eggs" = two add_shopping_item calls).
- After performing actions, briefly confirm what you did.
- For queries, summarize the data in a readable way rather than dumping raw data.
- If you're unsure what the user wants, ask a clarifying question rather than guessing.
- Priority levels for tasks: 0=none, 1=low, 2=medium, 3=high, 4=urgent.
- When a tool returns an error, explain it naturally to the user."""
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "from app.services.ai.prompts import build_system_prompt; print(build_system_prompt()[:50])"`
Expected: Starts with `You are a helpful personal assistant`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/ai/prompts.py
git commit -m "feat: add system prompt for AI chatbot"
```

---

### Task 6: Chat Models

**Files:**
- Create: `backend/app/models/chat.py`

- [ ] **Step 1: Create chat models**

Create `backend/app/models/chat.py`:

```python
from datetime import datetime

from pydantic import BaseModel, Field


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
    actions: list[ChatAction] | None = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "from app.models.chat import ChatMessageRequest; print(ChatMessageRequest(message='hello'))"`
Expected: `message='hello'`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/chat.py
git commit -m "feat: add chat Pydantic models"
```

---

### Task 7: ChatService

**Files:**
- Create: `backend/app/services/chat.py`

This is the core orchestration service that ties everything together.

- [ ] **Step 1: Implement ChatService**

Create `backend/app/services/chat.py`:

```python
import json
import logging

from app.db.client import get_supabase
from app.models.chat import ChatAction, ChatMessageResponse
from app.services.ai.openai_client import chat_completion
from app.services.ai.prompts import build_system_prompt
from app.services.ai.tools import TOOL_DEFINITIONS, execute_tool
from app.services.shopping import ShoppingService
from app.services.tasks import TaskService

logger = logging.getLogger(__name__)

MAX_HISTORY = 20
MAX_TOOL_ROUNDS = 5


class ChatService:
    def __init__(self) -> None:
        self._db = get_supabase()
        self._shopping = ShoppingService()
        self._task = TaskService()

    async def send_message(self, user_id: str, message: str) -> ChatMessageResponse:
        self._db.table("chat_messages").insert({
            "user_id": user_id,
            "role": "user",
            "content": message,
        }).execute()

        history = self._load_history_for_openai(user_id)

        messages = [
            {"role": "system", "content": build_system_prompt()},
            *history,
        ]

        actions: list[ChatAction] = []
        rounds = 0

        while rounds < MAX_TOOL_ROUNDS:
            rounds += 1
            response_message = await chat_completion(messages, tools=TOOL_DEFINITIONS)

            if not response_message.tool_calls:
                break

            assistant_msg = {
                "role": "assistant",
                "content": response_message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in response_message.tool_calls
                ],
            }
            messages.append(assistant_msg)

            self._db.table("chat_messages").insert({
                "user_id": user_id,
                "role": "assistant",
                "content": response_message.content or "",
                "tool_calls": assistant_msg["tool_calls"],
            }).execute()

            for tool_call in response_message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                result = await execute_tool(
                    fn_name, fn_args, user_id, self._shopping, self._task
                )

                is_error = "error" in result
                actions.append(ChatAction(
                    tool_name=fn_name,
                    params=fn_args,
                    result=result if not is_error else None,
                    success=not is_error,
                    error=result.get("error") if is_error else None,
                ))

                tool_result_str = json.dumps(result, default=str)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result_str,
                })

                self._db.table("chat_messages").insert({
                    "user_id": user_id,
                    "role": "tool",
                    "content": tool_result_str,
                    "tool_call_id": tool_call.id,
                }).execute()

        final_content = response_message.content or ""

        result = self._db.table("chat_messages").insert({
            "user_id": user_id,
            "role": "assistant",
            "content": final_content,
        }).execute()

        return ChatMessageResponse(
            id=result.data[0]["id"],
            role="assistant",
            content=final_content,
            actions=actions if actions else None,
            created_at=result.data[0]["created_at"],
        )

    def _load_history_for_openai(self, user_id: str) -> list[dict]:
        """Load recent messages and reconstruct OpenAI-compatible message format."""
        result = (
            self._db.table("chat_messages")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(MAX_HISTORY)
            .execute()
        )
        rows = list(reversed(result.data))

        messages = []
        for row in rows:
            if row["role"] == "user":
                messages.append({"role": "user", "content": row["content"]})
            elif row["role"] == "assistant" and row.get("tool_calls"):
                messages.append({
                    "role": "assistant",
                    "content": row["content"],
                    "tool_calls": row["tool_calls"],
                })
            elif row["role"] == "assistant":
                messages.append({"role": "assistant", "content": row["content"]})
            elif row["role"] == "tool" and row.get("tool_call_id"):
                messages.append({
                    "role": "tool",
                    "tool_call_id": row["tool_call_id"],
                    "content": row["content"],
                })
        return messages

    async def get_history(self, user_id: str, limit: int = 50) -> list[ChatMessageResponse]:
        """Get user-facing chat history (only user + assistant text messages)."""
        result = (
            self._db.table("chat_messages")
            .select("*")
            .eq("user_id", user_id)
            .in_("role", ["user", "assistant"])
            .is_("tool_calls", "null")
            .order("created_at")
            .limit(limit)
            .execute()
        )
        return [
            ChatMessageResponse(
                id=row["id"],
                role=row["role"],
                content=row["content"],
                actions=None,
                created_at=row["created_at"],
            )
            for row in result.data
        ]

    async def clear_history(self, user_id: str) -> None:
        self._db.table("chat_messages").delete().eq("user_id", user_id).execute()
```

- [ ] **Step 2: Verify import**

Run: `cd backend && python -c "from app.services.chat import ChatService; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/chat.py
git commit -m "feat: add ChatService with OpenAI function calling loop"
```

---

### Task 8: Chat API Routes

**Files:**
- Create: `backend/app/api/v1/routes/chat.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create chat routes**

Create `backend/app/api/v1/routes/chat.py`:

```python
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from openai import APIConnectionError, RateLimitError, APIStatusError

from app.core.security import get_current_user
from app.models.chat import ChatHistoryResponse, ChatMessageRequest, ChatMessageResponse
from app.services.chat import ChatService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


def get_chat_service() -> ChatService:
    return ChatService()


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    body: ChatMessageRequest,
    user: dict = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
):
    try:
        return await service.send_message(user["sub"], body.message)
    except APIConnectionError:
        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily unavailable. Please try again.",
        )
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="AI service is busy. Please try again in a moment.",
        )
    except APIStatusError:
        raise HTTPException(
            status_code=502,
            detail="AI service encountered an error. Please try again.",
        )


@router.get("/history", response_model=ChatHistoryResponse)
async def get_history(
    limit: int = Query(default=50, ge=1, le=200),
    user: dict = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
):
    messages = await service.get_history(user["sub"], limit)
    return ChatHistoryResponse(messages=messages)


@router.delete("/history")
async def clear_history(
    user: dict = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
):
    await service.clear_history(user["sub"])
    return {"status": "ok"}
```

- [ ] **Step 2: Register chat router in main.py**

In `backend/app/main.py`, add the import and registration:

```python
from app.api.v1.routes.chat import router as chat_router
```

And add after the existing `app.include_router` lines:

```python
app.include_router(chat_router, prefix="/api/v1")
```

- [ ] **Step 3: Verify server starts**

Run: `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
Expected: Server starts without import errors. Check `http://localhost:8000/docs` shows `/api/v1/chat/` endpoints.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/chat.py backend/app/main.py
git commit -m "feat: add chat API routes and register router"
```

---

### Task 9: Frontend Types & API

**Files:**
- Create: `frontend/src/types/chat.ts`
- Create: `frontend/src/features/chat/api.ts`

- [ ] **Step 1: Create chat types**

Create `frontend/src/types/chat.ts`:

```typescript
export interface IChatAction {
  tool_name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
}

export interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: IChatAction[] | null;
  created_at: string;
}

export interface IChatHistoryResponse {
  messages: IChatMessage[];
}
```

- [ ] **Step 2: Create chat API module**

Create `frontend/src/features/chat/api.ts`:

```typescript
import { api } from "@/lib/api";
import type { IChatHistoryResponse, IChatMessage } from "@/types/chat";

export const chatApi = {
  sendMessage: (message: string) =>
    api
      .post<IChatMessage>("/chat/message", { message })
      .then((res) => res.data),

  getHistory: (limit = 50) =>
    api
      .get<IChatHistoryResponse>("/chat/history", { params: { limit } })
      .then((res) => res.data.messages),

  clearHistory: () => api.delete("/chat/history"),
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/chat.ts frontend/src/features/chat/api.ts
git commit -m "feat: add chat TypeScript types and API client"
```

---

### Task 10: Frontend Chat Hooks

**Files:**
- Create: `frontend/src/features/chat/useChatHooks.ts`

- [ ] **Step 1: Create chat hooks**

Create `frontend/src/features/chat/useChatHooks.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import type { IChatMessage } from "@/types/chat";
import { chatApi } from "./api";

const CHAT_HISTORY_KEY = ["chat-history"];

export function useChatHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CHAT_HISTORY_KEY,
    queryFn: () => chatApi.getHistory(),
    enabled: !!user,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(message),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: CHAT_HISTORY_KEY });
      const previous = queryClient.getQueryData<IChatMessage[]>(CHAT_HISTORY_KEY);

      const optimisticMsg: IChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        actions: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<IChatMessage[]>(CHAT_HISTORY_KEY, (old) => [
        ...(old ?? []),
        optimisticMsg,
      ]);

      return { previous };
    },
    onSuccess: (response) => {
      queryClient.setQueryData<IChatMessage[]>(CHAT_HISTORY_KEY, (old) => {
        if (!old) return [response];
        const withoutTemp = old.filter(
          (msg) => !msg.id.startsWith("temp-") || msg.role !== "user"
        );
        return [...withoutTemp, response];
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CHAT_HISTORY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_HISTORY_KEY });
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatApi.clearHistory(),
    onSuccess: () => {
      queryClient.setQueryData(CHAT_HISTORY_KEY, []);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/chat/useChatHooks.ts
git commit -m "feat: add chat TanStack Query hooks with optimistic updates"
```

---

### Task 11: Frontend Chat UI Components

**Files:**
- Create: `frontend/src/features/chat/ChatWidget.tsx`
- Create: `frontend/src/features/chat/ChatToggleButton.tsx`
- Create: `frontend/src/features/chat/ChatPanel.tsx`
- Create: `frontend/src/features/chat/ChatMessageBubble.tsx`
- Create: `frontend/src/features/chat/ChatActionCard.tsx`
- Create: `frontend/src/features/chat/ChatInput.tsx`
- Create: `frontend/src/features/chat/TypingIndicator.tsx`

- [ ] **Step 1: Create TypingIndicator**

Create `frontend/src/features/chat/TypingIndicator.tsx`:

```tsx
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ChatActionCard**

Create `frontend/src/features/chat/ChatActionCard.tsx`:

```tsx
import { CheckCircle2, XCircle } from "lucide-react";

import type { IChatAction } from "@/types/chat";

const TOOL_LABELS: Record<string, string> = {
  add_shopping_item: "Added item",
  remove_shopping_item: "Removed item",
  check_shopping_item: "Updated item",
  check_all_shopping_items: "Updated all items",
  create_shopping_list: "Created list",
  get_shopping_lists: "Fetched lists",
  get_shopping_list_detail: "Fetched list details",
  create_task: "Created task",
  complete_task: "Completed task",
  delete_task: "Deleted task",
  get_tasks: "Fetched tasks",
  get_daily_summary: "Fetched summary",
  get_task_groups: "Fetched groups",
  get_everything_summary: "Fetched overview",
};

interface ChatActionCardProps {
  action: IChatAction;
}

export function ChatActionCard({ action }: ChatActionCardProps) {
  const label = TOOL_LABELS[action.tool_name] ?? action.tool_name;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
        action.success
          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      {action.success ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{label}</span>
      {action.error && <span className="text-red-500">— {action.error}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create ChatMessageBubble**

Create `frontend/src/features/chat/ChatMessageBubble.tsx`:

```tsx
import type { IChatMessage } from "@/types/chat";
import { ChatActionCard } from "./ChatActionCard";

interface ChatMessageBubbleProps {
  message: IChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] space-y-1">
        <div
          className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
            isUser
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
          }`}
        >
          {message.content}
        </div>
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1">
            {message.actions.map((action, idx) => (
              <ChatActionCard key={idx} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ChatInput**

Create `frontend/src/features/chat/ChatInput.tsx`:

```tsx
import { useState, useRef } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="flex items-end gap-2 border-t p-3 dark:border-gray-700">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create ChatPanel**

Create `frontend/src/features/chat/ChatPanel.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";

import { useChatHistory, useSendMessage, useClearHistory } from "./useChatHooks";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { data: messages = [], isLoading } = useChatHistory();
  const sendMessage = useSendMessage();
  const clearHistory = useClearHistory();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold">AI Assistant</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => clearHistory.mutate()}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-sm text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-8">
            Hi! I can help you manage your tasks and shopping lists.
            Try saying "What do I have today?" or "Add milk to my grocery list".
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))
        )}
        {sendMessage.isPending && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={(message) => sendMessage.mutate(message)}
        disabled={sendMessage.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create ChatToggleButton**

Create `frontend/src/features/chat/ChatToggleButton.tsx`:

```tsx
import { MessageCircle } from "lucide-react";

interface ChatToggleButtonProps {
  onClick: () => void;
}

export function ChatToggleButton({ onClick }: ChatToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 hover:scale-105 active:scale-95"
      aria-label="Open chat"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}
```

- [ ] **Step 7: Create ChatWidget**

Create `frontend/src/features/chat/ChatWidget.tsx`:

```tsx
import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { ChatToggleButton } from "./ChatToggleButton";
import { ChatPanel } from "./ChatPanel";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      {!isOpen && <ChatToggleButton onClick={() => setIsOpen(true)} />}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 h-[calc(100vh-4rem)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[600px] sm:w-[400px] sm:rounded-2xl sm:shadow-2xl sm:border dark:sm:border-gray-700 overflow-hidden">
          <ChatPanel onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/chat/
git commit -m "feat: add chat UI components (widget, panel, bubbles, input)"
```

---

### Task 12: Integrate ChatWidget into App

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add ChatWidget to App.tsx**

Add the import at the top of `frontend/src/App.tsx`:

```typescript
import { ChatWidget } from "@/features/chat/ChatWidget";
```

Then add `<ChatWidget />` inside the `ToastProvider`, after `Routes`:

```tsx
<ToastProvider>
  <Routes>
    {/* ... existing routes ... */}
  </Routes>
  <ChatWidget />
</ToastProvider>
```

The full `App` function return should be:

```tsx
return (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<AppShell />}>
              <Route path="/shopping" element={<ShoppingListsPage />} />
              <Route
                path="/shopping/:id"
                element={<ShoppingListDetailPage />}
              />
              <Route path="/tasks" element={<TasksPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/shopping" replace />} />
          </Routes>
          <ChatWidget />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: integrate ChatWidget into App layout"
```

---

### Task 13: Update Phase 4 Doc

**Files:**
- Modify: `docs/phases/phase-4-ai-chatbot.md`

- [ ] **Step 1: Update the phase doc header to reflect OpenAI instead of Ollama**

Change the title from "Phase 4: AI Chatbot (Ollama)" to "Phase 4: AI Chatbot (OpenAI)". Update the overview to mention OpenAI GPT-4o-mini with function calling instead of Ollama. Remove Ollama prerequisites and replace with OpenAI API key requirement.

- [ ] **Step 2: Commit**

```bash
git add docs/phases/phase-4-ai-chatbot.md
git commit -m "docs: update phase-4 doc to reflect OpenAI instead of Ollama"
```

---

### Task 14: End-to-End Smoke Test

- [ ] **Step 1: Start backend**

Run: `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
Expected: Server starts, no import errors

- [ ] **Step 2: Start frontend**

Run: `cd frontend && npm run dev`
Expected: Dev server starts at `http://localhost:5173`

- [ ] **Step 3: Test chat flow**

1. Log in to the app
2. Click the chat button (bottom-right)
3. Type "What do I have today?" → should get a daily summary response
4. Type "Add milk to my grocery list" → should add item (or ask which list if ambiguous)
5. Type "Create a task: call dentist tomorrow, high priority" → should create task
6. Type "Check off all items on my grocery list" → should batch-check
7. Click the trash icon → should clear history
8. Close and reopen panel → history should persist (if not cleared)

- [ ] **Step 4: Verify error handling**

1. Set `OPENAI_API_KEY` to an invalid value, restart backend
2. Send a message → should get "AI service encountered an error" message, not a crash

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: AI chatbot with OpenAI GPT-4o-mini function calling"
```
