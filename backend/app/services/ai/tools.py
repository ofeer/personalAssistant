import logging
from datetime import date

from app.models.shopping import ShoppingItemCreate, ShoppingItemUpdate, ShoppingListCreate
from app.models.tasks import TaskCreate, TaskGroupCreate, TaskUpdate
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
            "name": "add_shopping_items",
            "description": "Add multiple items to a shopping list at once. Use this instead of add_shopping_item when the user provides several items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_name": {
                        "type": "string",
                        "description": "Name of the shopping list",
                    },
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "Name of the item",
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
                            "required": ["name"],
                        },
                        "description": "List of items to add",
                    },
                },
                "required": ["list_name", "items"],
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
            "name": "create_tasks",
            "description": "Create multiple tasks at once. Use this instead of create_task when the user provides several tasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "items": {
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
                        "description": "List of tasks to create",
                    },
                },
                "required": ["tasks"],
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
            "name": "create_task_group",
            "description": "Create a new task group for organizing tasks",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name for the new task group",
                    },
                    "color": {
                        "type": "string",
                        "description": "Color hex code (e.g. #6366f1). Optional.",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Update an existing task's properties (title, due date, priority, group, status, description)",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_title": {
                        "type": "string",
                        "description": "Current title of the task to update (used to find the task)",
                    },
                    "new_title": {
                        "type": "string",
                        "description": "New title for the task",
                    },
                    "description": {
                        "type": "string",
                        "description": "New description",
                    },
                    "due_date": {
                        "type": "string",
                        "description": "New due date in YYYY-MM-DD format",
                    },
                    "priority": {
                        "type": "integer",
                        "enum": [0, 1, 2, 3, 4],
                        "description": "Priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent",
                    },
                    "status": {
                        "type": "string",
                        "enum": ["todo", "in_progress", "done", "cancelled"],
                        "description": "New status",
                    },
                    "group_name": {
                        "type": "string",
                        "description": "Name of the task group to move the task to",
                    },
                },
                "required": ["task_title"],
            },
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

        elif tool_name == "add_shopping_items":
            list_id = await _resolve_shopping_list_id(
                shopping_service, user_id, arguments["list_name"]
            )
            added = []
            failed = []
            for item in arguments["items"]:
                try:
                    payload = ShoppingItemCreate(
                        name=item["name"],
                        amount=item.get("amount", 1),
                        unit=item.get("unit"),
                    )
                    result = await shopping_service.add_item(list_id, user_id, payload)
                    added.append(result)
                except Exception as exc:
                    failed.append({"name": item["name"], "error": str(exc)})
            return {"added": added, "added_count": len(added), "failed": failed}

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
                due_date=arguments.get("due_date") or str(date.today()),
                group_id=group_id,
            )
            return await task_service.create_task(user_id, payload)

        elif tool_name == "create_tasks":
            created = []
            failed = []
            for task in arguments["tasks"]:
                try:
                    group_id = None
                    if task.get("group_name"):
                        group_id = await _resolve_group_by_name(
                            task_service, user_id, task["group_name"]
                        )
                    payload = TaskCreate(
                        title=task["title"],
                        description=task.get("description"),
                        priority=task.get("priority", 0),
                        due_date=task.get("due_date") or str(date.today()),
                        group_id=group_id,
                    )
                    result = await task_service.create_task(user_id, payload)
                    created.append(result)
                except Exception as exc:
                    failed.append({"title": task["title"], "error": str(exc)})
            return {"created": created, "created_count": len(created), "failed": failed}

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

        elif tool_name == "create_task_group":
            payload = TaskGroupCreate(
                name=arguments["name"],
                color=arguments.get("color", "#6366f1"),
            )
            return await task_service.create_group(user_id, payload)

        elif tool_name == "update_task":
            task_id = await _resolve_task_by_title(
                task_service, user_id, arguments["task_title"]
            )
            group_id = None
            if arguments.get("group_name"):
                group_id = await _resolve_group_by_name(
                    task_service, user_id, arguments["group_name"]
                )
            update_fields: dict = {}
            if arguments.get("new_title"):
                update_fields["title"] = arguments["new_title"]
            if arguments.get("description") is not None:
                update_fields["description"] = arguments["description"]
            if arguments.get("due_date"):
                update_fields["due_date"] = arguments["due_date"]
            if arguments.get("priority") is not None:
                update_fields["priority"] = arguments["priority"]
            if arguments.get("status"):
                update_fields["status"] = arguments["status"]
            if group_id:
                update_fields["group_id"] = group_id
            if not update_fields:
                return {"error": "No fields to update. Provide at least one field to change."}
            payload = TaskUpdate(**update_fields)
            return await task_service.update_task(task_id, user_id, payload)

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
        logger.error("Tool execution failed: tool=%s %s", tool_name, str(exc))
        return {"error": f"Failed to execute {tool_name}: {str(exc)}"}
