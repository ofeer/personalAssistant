from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

VALID_STATUSES = ("todo", "in_progress", "done", "cancelled")
VALID_RECURRENCES = ("daily", "weekly", "monthly")


class TaskGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    color: str = Field(default="#6366f1", max_length=20)


class TaskGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=20)
    sort_order: int | None = None


class TaskGroupResponse(BaseModel):
    id: str
    user_id: str
    name: str
    color: str
    sort_order: int
    created_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    priority: int = Field(default=0, ge=0, le=4)
    status: Literal["todo", "in_progress", "done", "cancelled"] = "todo"
    due_date: date | None = None
    due_time: time | None = None
    recurrence: Literal["daily", "weekly", "monthly"] | None = None
    group_id: str | None = None
    parent_task_id: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    priority: int | None = Field(default=None, ge=0, le=4)
    status: Literal["todo", "in_progress", "done", "cancelled"] | None = None
    due_date: date | None = None
    due_time: time | None = None
    recurrence: Literal["daily", "weekly", "monthly"] | None = None
    group_id: str | None = None


class TaskStatusUpdate(BaseModel):
    status: Literal["todo", "in_progress", "done", "cancelled"]


class TaskResponse(BaseModel):
    id: str
    user_id: str
    group_id: str | None
    parent_task_id: str | None
    title: str
    description: str | None
    priority: int
    status: str
    due_date: date | None
    due_time: time | None
    recurrence: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    sort_order: int = 0
    subtask_count: int = 0
    subtask_done_count: int = 0
    labels: list["LabelResponse"] = []


class TaskDetailResponse(TaskResponse):
    subtasks: list[TaskResponse] = []
    reminders: list["ReminderResponse"] = []
    group: TaskGroupResponse | None = None


class ReminderCreate(BaseModel):
    remind_at: datetime
    type: Literal["push", "email"] = "push"


class ReminderResponse(BaseModel):
    id: str
    task_id: str
    remind_at: datetime
    type: str
    is_sent: bool
    created_at: datetime


class ReorderItem(BaseModel):
    id: str
    sort_order: int


class ReorderTasksPayload(BaseModel):
    items: list[ReorderItem] = Field(..., min_length=1)


class LabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6366f1", max_length=20)


class LabelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=20)


class LabelResponse(BaseModel):
    id: str
    user_id: str
    name: str
    color: str
    created_at: datetime


class DailySummaryResponse(BaseModel):
    overdue_count: int
    today_tasks: list[TaskResponse]
    upcoming_tasks: list[TaskResponse]
