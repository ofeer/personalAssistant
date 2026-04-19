from __future__ import annotations

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
            timeout=60.0,
        )
    return _client


async def chat_completion(
    messages: list[ChatCompletionMessageParam],
    tools: list[ChatCompletionToolParam] | None = None,
) -> dict:
    """Call OpenAI chat completions. Returns the response message."""
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

    except APIConnectionError as exc:
        logger.error("OpenAI API connection failed: %s", str(exc))
        raise
    except RateLimitError:
        logger.warning("OpenAI API rate limited")
        raise
    except APIStatusError as exc:
        logger.error("OpenAI API error: status=%s %s", exc.status_code, str(exc))
        raise
