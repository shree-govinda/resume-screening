from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.interviewer import Interviewer
from app.models.user import User, UserRole
from app.schemas.interviewer import InterviewerCreate, InterviewerOut, InterviewerUpdate

router = APIRouter(prefix="/interviewers", tags=["admin - interviewers"])

AdminOnly = Depends(require_role(UserRole.admin))


@router.post("", response_model=InterviewerOut, status_code=status.HTTP_201_CREATED)
async def create_interviewer(
    body: InterviewerCreate,
    current_user: Annotated[User, AdminOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    interviewer = Interviewer(**body.model_dump())
    db.add(interviewer)
    await db.flush()
    return interviewer


@router.get("", response_model=list[InterviewerOut])
async def list_interviewers(
    current_user: Annotated[User, AdminOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
    round: int | None = None,
    active_only: bool = True,
):
    query = select(Interviewer)
    if active_only:
        query = query.where(Interviewer.is_active == True)  # noqa: E712
    result = await db.execute(query.order_by(Interviewer.name))
    interviewers = result.scalars().all()
    if round:
        interviewers = [iv for iv in interviewers if round in (iv.eligible_rounds or [])]
    return interviewers


@router.patch("/{interviewer_id}", response_model=InterviewerOut)
async def patch_interviewer(
    interviewer_id: UUID,
    body: InterviewerUpdate,
    current_user: Annotated[User, AdminOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Interviewer).where(Interviewer.id == interviewer_id))
    iv = result.scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(iv, field, value)
    return iv


@router.put("/{interviewer_id}", response_model=InterviewerOut)
async def update_interviewer(
    interviewer_id: UUID,
    body: InterviewerCreate,
    current_user: Annotated[User, AdminOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Interviewer).where(Interviewer.id == interviewer_id))
    iv = result.scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    for field, value in body.model_dump().items():
        setattr(iv, field, value)
    return iv


@router.delete("/{interviewer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interviewer(
    interviewer_id: UUID,
    current_user: Annotated[User, AdminOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.round import InterviewRound
    result = await db.execute(select(Interviewer).where(Interviewer.id == interviewer_id))
    iv = result.scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interviewer not found")
    # Check for associated rounds — hard-delete would violate FK constraint
    rounds_result = await db.execute(
        select(InterviewRound).where(InterviewRound.interviewer_id == interviewer_id).limit(1)
    )
    if rounds_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete interviewer with existing interview rounds. Deactivate them instead.",
        )
    await db.delete(iv)
