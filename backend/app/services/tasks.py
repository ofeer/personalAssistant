from datetime import date, datetime, timedelta

from fastapi import HTTPException, status

from app.db.client import get_supabase
from app.models.tasks import (
    LabelCreate,
    LabelUpdate,
    ReminderCreate,
    ReorderTasksPayload,
    TaskCreate,
    TaskGroupCreate,
    TaskGroupUpdate,
    TaskStatusUpdate,
    TaskUpdate,
)


class TaskService:
    def __init__(self) -> None:
        self._db = get_supabase()

    # ── Task Groups ──────────────────────────────────────────────

    async def get_groups(self, user_id: str) -> list[dict]:
        result = (
            self._db.table("task_groups")
            .select("*")
            .eq("user_id", user_id)
            .order("sort_order")
            .execute()
        )
        return result.data

    async def create_group(self, user_id: str, payload: TaskGroupCreate) -> dict:
        result = (
            self._db.table("task_groups")
            .insert({
                "user_id": user_id,
                "name": payload.name,
                "color": payload.color,
            })
            .execute()
        )
        return result.data[0]

    async def update_group(
        self, group_id: str, user_id: str, payload: TaskGroupUpdate
    ) -> dict:
        await self._verify_group_ownership(group_id, user_id)
        update_data = payload.model_dump(exclude_none=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )
        result = (
            self._db.table("task_groups")
            .update(update_data)
            .eq("id", group_id)
            .execute()
        )
        return result.data[0]

    async def delete_group(self, group_id: str, user_id: str) -> None:
        await self._verify_group_ownership(group_id, user_id)
        self._db.table("task_groups").delete().eq("id", group_id).execute()

    # ── Tasks ────────────────────────────────────────────────────

    async def get_tasks(
        self,
        user_id: str,
        view: str = "today",
        task_status: str | None = None,
        group_id: str | None = None,
        priority: int | None = None,
    ) -> list[dict]:
        query = (
            self._db.table("tasks")
            .select("*, subtasks:tasks!parent_task_id(id, status), task_label_assignments(label_id, task_labels(*))")
            .eq("user_id", user_id)
            .is_("parent_task_id", "null")
        )

        today = date.today()

        if view == "all":
            query = query.order("priority", desc=True).order("sort_order")
        elif view == "group":
            query = query.order("group_id").order("priority", desc=True).order("sort_order")
        elif view == "today":
            query = query.or_(
                f"due_date.eq.{today},and(due_date.lt.{today},status.neq.done)"
            )
            query = query.order("priority", desc=True).order("sort_order")
        elif view == "week":
            week_end = today + timedelta(days=7)
            query = query.gte("due_date", str(today)).lte("due_date", str(week_end))
            query = query.order("due_date").order("priority", desc=True).order("sort_order")
        elif view == "priority":
            query = query.order("priority", desc=True).order("sort_order")

        if task_status:
            query = query.eq("status", task_status)
        if group_id:
            query = query.eq("group_id", group_id)
        if priority is not None:
            query = query.eq("priority", priority)

        result = query.execute()

        tasks = []
        for row in result.data:
            subtasks = row.pop("subtasks", [])
            row["subtask_count"] = len(subtasks)
            row["subtask_done_count"] = sum(
                1 for st in subtasks if st["status"] == "done"
            )
            assignments = row.pop("task_label_assignments", [])
            row["labels"] = [
                a["task_labels"] for a in assignments if a.get("task_labels")
            ]
            tasks.append(row)
        return tasks

    async def get_task(self, task_id: str, user_id: str) -> dict:
        result = (
            self._db.table("tasks")
            .select("*, task_reminders(*), task_groups(*), subtasks:tasks!parent_task_id(*)")
            .eq("id", task_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )
        row = result.data
        subtasks_raw = row.pop("subtasks", [])
        row["subtasks"] = subtasks_raw
        for st in row["subtasks"]:
            st["subtask_count"] = 0
            st["subtask_done_count"] = 0
        row["subtask_count"] = len(subtasks_raw)
        row["subtask_done_count"] = sum(
            1 for st in subtasks_raw if st["status"] == "done"
        )
        row["reminders"] = row.pop("task_reminders", [])

        group_data = row.pop("task_groups", None)
        row["group"] = group_data

        row["labels"] = await self.get_task_labels(task_id, user_id)

        return row

    async def create_task(self, user_id: str, payload: TaskCreate) -> dict:
        if payload.parent_task_id:
            await self._verify_task_ownership(payload.parent_task_id, user_id)
        if payload.group_id:
            await self._verify_group_ownership(payload.group_id, user_id)

        data = {
            "user_id": user_id,
            **payload.model_dump(exclude_none=True),
        }
        if payload.due_date:
            data["due_date"] = str(payload.due_date)
        if payload.due_time:
            data["due_time"] = str(payload.due_time)

        result = self._db.table("tasks").insert(data).execute()
        row = result.data[0]
        row["subtask_count"] = 0
        row["subtask_done_count"] = 0
        return row

    async def update_task(
        self, task_id: str, user_id: str, payload: TaskUpdate
    ) -> dict:
        current = await self._get_raw_task(task_id, user_id)
        update_data = payload.model_dump(exclude_none=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        if payload.group_id:
            await self._verify_group_ownership(payload.group_id, user_id)

        if "due_date" in update_data and update_data["due_date"]:
            update_data["due_date"] = str(update_data["due_date"])
        if "due_time" in update_data and update_data["due_time"]:
            update_data["due_time"] = str(update_data["due_time"])

        if payload.status == "done" and current["status"] != "done":
            update_data["completed_at"] = datetime.utcnow().isoformat()
        elif payload.status and payload.status != "done" and current["status"] == "done":
            update_data["completed_at"] = None

        result = (
            self._db.table("tasks")
            .update(update_data)
            .eq("id", task_id)
            .execute()
        )
        row = result.data[0]
        row["subtask_count"] = 0
        row["subtask_done_count"] = 0

        if (
            payload.status == "done"
            and current["status"] != "done"
            and current.get("recurrence")
        ):
            await self._create_next_recurrence(current, user_id)

        return row

    async def update_task_status(
        self, task_id: str, user_id: str, payload: TaskStatusUpdate
    ) -> dict:
        update = TaskUpdate(status=payload.status)
        return await self.update_task(task_id, user_id, update)

    async def reorder_tasks(self, user_id: str, payload: ReorderTasksPayload) -> None:
        for item in payload.items:
            self._db.table("tasks").update(
                {"sort_order": item.sort_order}
            ).eq("id", item.id).eq("user_id", user_id).execute()

    async def delete_task(self, task_id: str, user_id: str) -> None:
        await self._verify_task_ownership(task_id, user_id)
        self._db.table("tasks").delete().eq("id", task_id).execute()

    async def get_daily_summary(self, user_id: str) -> dict:
        today = date.today()
        upcoming_end = today + timedelta(days=3)

        all_tasks = (
            self._db.table("tasks")
            .select("*")
            .eq("user_id", user_id)
            .is_("parent_task_id", "null")
            .neq("status", "done")
            .neq("status", "cancelled")
            .not_.is_("due_date", "null")
            .lte("due_date", str(upcoming_end))
            .order("due_date")
            .order("priority", desc=True)
            .execute()
        )

        overdue = []
        today_tasks = []
        upcoming = []
        for task in all_tasks.data:
            task["subtask_count"] = 0
            task["subtask_done_count"] = 0
            task_date = date.fromisoformat(task["due_date"])
            if task_date < today:
                overdue.append(task)
            elif task_date == today:
                today_tasks.append(task)
            else:
                upcoming.append(task)

        return {
            "overdue_count": len(overdue),
            "today_tasks": overdue + today_tasks,
            "upcoming_tasks": upcoming,
        }

    # ── Labels ────────────────────────────────────────────────────

    async def get_labels(self, user_id: str) -> list[dict]:
        result = (
            self._db.table("task_labels")
            .select("*")
            .eq("user_id", user_id)
            .order("name")
            .execute()
        )
        return result.data

    async def create_label(self, user_id: str, payload: LabelCreate) -> dict:
        result = (
            self._db.table("task_labels")
            .insert({
                "user_id": user_id,
                "name": payload.name,
                "color": payload.color,
            })
            .execute()
        )
        return result.data[0]

    async def update_label(
        self, label_id: str, user_id: str, payload: LabelUpdate
    ) -> dict:
        await self._verify_label_ownership(label_id, user_id)
        update_data = payload.model_dump(exclude_none=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )
        result = (
            self._db.table("task_labels")
            .update(update_data)
            .eq("id", label_id)
            .execute()
        )
        return result.data[0]

    async def delete_label(self, label_id: str, user_id: str) -> None:
        await self._verify_label_ownership(label_id, user_id)
        self._db.table("task_labels").delete().eq("id", label_id).execute()

    async def assign_label(
        self, task_id: str, label_id: str, user_id: str
    ) -> None:
        await self._verify_task_ownership(task_id, user_id)
        await self._verify_label_ownership(label_id, user_id)
        self._db.table("task_label_assignments").insert({
            "task_id": task_id,
            "label_id": label_id,
        }).execute()

    async def unassign_label(
        self, task_id: str, label_id: str, user_id: str
    ) -> None:
        await self._verify_task_ownership(task_id, user_id)
        (
            self._db.table("task_label_assignments")
            .delete()
            .eq("task_id", task_id)
            .eq("label_id", label_id)
            .execute()
        )

    async def get_task_labels(self, task_id: str, user_id: str) -> list[dict]:
        await self._verify_task_ownership(task_id, user_id)
        result = (
            self._db.table("task_label_assignments")
            .select("label_id, task_labels(*)")
            .eq("task_id", task_id)
            .execute()
        )
        return [row["task_labels"] for row in result.data if row.get("task_labels")]

    # ── Reminders ────────────────────────────────────────────────

    async def create_reminder(
        self, task_id: str, user_id: str, payload: ReminderCreate
    ) -> dict:
        await self._verify_task_ownership(task_id, user_id)
        result = (
            self._db.table("task_reminders")
            .insert({
                "task_id": task_id,
                "remind_at": payload.remind_at.isoformat(),
                "type": payload.type,
            })
            .execute()
        )
        return result.data[0]

    async def delete_reminder(self, reminder_id: str, user_id: str) -> None:
        result = (
            self._db.table("task_reminders")
            .select("id, task_id, tasks!inner(user_id)")
            .eq("id", reminder_id)
            .eq("tasks.user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reminder not found",
            )
        self._db.table("task_reminders").delete().eq("id", reminder_id).execute()

    # ── Recurring tasks ──────────────────────────────────────────

    async def _create_next_recurrence(self, task: dict, user_id: str) -> None:
        if not task.get("due_date") or not task.get("recurrence"):
            return

        current_due = date.fromisoformat(task["due_date"])
        recurrence = task["recurrence"]

        if recurrence == "daily":
            next_due = current_due + timedelta(days=1)
        elif recurrence == "weekly":
            next_due = current_due + timedelta(weeks=1)
        elif recurrence == "monthly":
            month = current_due.month + 1
            year = current_due.year
            if month > 12:
                month = 1
                year += 1
            day = min(current_due.day, 28)
            next_due = date(year, month, day)
        else:
            return

        self._db.table("tasks").insert({
            "user_id": user_id,
            "title": task["title"],
            "description": task.get("description"),
            "priority": task.get("priority", 0),
            "status": "todo",
            "due_date": str(next_due),
            "due_time": task.get("due_time"),
            "recurrence": recurrence,
            "group_id": task.get("group_id"),
        }).execute()

    # ── Ownership verification ───────────────────────────────────

    async def _get_raw_task(self, task_id: str, user_id: str) -> dict:
        result = (
            self._db.table("tasks")
            .select("*")
            .eq("id", task_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )
        return result.data

    async def _verify_task_ownership(self, task_id: str, user_id: str) -> None:
        result = (
            self._db.table("tasks")
            .select("id")
            .eq("id", task_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )

    async def _verify_label_ownership(self, label_id: str, user_id: str) -> None:
        result = (
            self._db.table("task_labels")
            .select("id")
            .eq("id", label_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label not found",
            )

    async def _verify_group_ownership(self, group_id: str, user_id: str) -> None:
        result = (
            self._db.table("task_groups")
            .select("id")
            .eq("id", group_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task group not found",
            )
