from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user
from app.models.tasks import (
    DailySummaryResponse,
    LabelCreate,
    LabelResponse,
    LabelUpdate,
    ReminderCreate,
    ReminderResponse,
    ReorderTasksPayload,
    TaskCreate,
    TaskDetailResponse,
    TaskGroupCreate,
    TaskGroupResponse,
    TaskGroupUpdate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.tasks import TaskService

router = APIRouter(tags=["tasks"])


def _get_service() -> TaskService:
    return TaskService()


# ── Task Groups ──────────────────────────────────────────────────

@router.get("/task-groups", response_model=list[TaskGroupResponse])
async def get_groups(
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.get_groups(user_id)


@router.post("/task-groups", response_model=TaskGroupResponse, status_code=201)
async def create_group(
    payload: TaskGroupCreate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.create_group(user_id, payload)


@router.patch("/task-groups/{group_id}", response_model=TaskGroupResponse)
async def update_group(
    group_id: str,
    payload: TaskGroupUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.update_group(group_id, user_id, payload)


@router.delete("/task-groups/{group_id}", status_code=204)
async def delete_group(
    group_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.delete_group(group_id, user_id)


# ── Tasks ────────────────────────────────────────────────────────

@router.get("/tasks", response_model=list[TaskResponse])
async def get_tasks(
    view: str = Query(default="all", pattern="^(all|today|week|priority|group)$"),
    status: str | None = Query(default=None, alias="task_status"),
    group_id: str | None = None,
    priority: int | None = Query(default=None, ge=0, le=4),
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.get_tasks(user_id, view, status, group_id, priority)


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    payload: TaskCreate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.create_task(user_id, payload)


@router.get("/tasks/daily-summary", response_model=DailySummaryResponse)
async def get_daily_summary(
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.get_daily_summary(user_id)


@router.get("/tasks/{task_id}", response_model=TaskDetailResponse)
async def get_task(
    task_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.get_task(task_id, user_id)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.update_task(task_id, user_id, payload)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.delete_task(task_id, user_id)


@router.put("/tasks/reorder", status_code=204)
async def reorder_tasks(
    payload: ReorderTasksPayload,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.reorder_tasks(user_id, payload)


@router.patch("/tasks/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.update_task_status(task_id, user_id, payload)


# ── Labels ────────────────────────────────────────────────────────

@router.get("/task-labels", response_model=list[LabelResponse])
async def get_labels(
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.get_labels(user_id)


@router.post("/task-labels", response_model=LabelResponse, status_code=201)
async def create_label(
    payload: LabelCreate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.create_label(user_id, payload)


@router.patch("/task-labels/{label_id}", response_model=LabelResponse)
async def update_label(
    label_id: str,
    payload: LabelUpdate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.update_label(label_id, user_id, payload)


@router.delete("/task-labels/{label_id}", status_code=204)
async def delete_label(
    label_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.delete_label(label_id, user_id)


@router.post("/tasks/{task_id}/labels/{label_id}", status_code=204)
async def assign_label(
    task_id: str,
    label_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.assign_label(task_id, label_id, user_id)


@router.delete("/tasks/{task_id}/labels/{label_id}", status_code=204)
async def unassign_label(
    task_id: str,
    label_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.unassign_label(task_id, label_id, user_id)


# ── Reminders ────────────────────────────────────────────────────

@router.post(
    "/tasks/{task_id}/reminders", response_model=ReminderResponse, status_code=201
)
async def create_reminder(
    task_id: str,
    payload: ReminderCreate,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    return await service.create_reminder(task_id, user_id, payload)


@router.delete("/reminders/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: str,
    user_id: str = Depends(get_current_user),
    service: TaskService = Depends(_get_service),
):
    await service.delete_reminder(reminder_id, user_id)
