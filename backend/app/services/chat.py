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
        response_message = None

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

        final_content = response_message.content or "" if response_message else ""

        db_result = self._db.table("chat_messages").insert({
            "user_id": user_id,
            "role": "assistant",
            "content": final_content,
        }).execute()

        return ChatMessageResponse(
            id=db_result.data[0]["id"],
            role="assistant",
            content=final_content,
            actions=actions if actions else None,
            created_at=db_result.data[0]["created_at"],
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
