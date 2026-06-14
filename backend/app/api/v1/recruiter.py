from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.bias_flag import BiasFlag
from app.models.candidate import Candidate, CandidateStatus
from app.models.user import User, UserRole
from app.schemas.candidate import DecisionRequest, JustificationUpdate, RejectRequest
from app.schemas.round import BiasAckRequest
from app.services.audit_service import AuditService

router = APIRouter(tags=["recruiter"])

RecruiterOnly = Depends(require_role(UserRole.recruiter, UserRole.admin))


@router.patch("/bias-flags/{flag_id}/ack", status_code=status.HTTP_200_OK)
async def acknowledge_bias_flag(
    flag_id: UUID,
    body: BiasAckRequest,
    current_user: Annotated[User, RecruiterOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(BiasFlag).where(BiasFlag.id == flag_id))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Bias flag not found")
    flag.acknowledged_by = current_user.id
    flag.acknowledged_at = datetime.now(timezone.utc)
    flag.ack_comment = body.comment
    await AuditService.log(db, "bias_flag", flag_id, "acknowledged", current_user.id, {"comment": body.comment})
    return {"detail": "Flag acknowledged"}


@router.patch("/resumes/{candidate_id}/justification", status_code=status.HTTP_200_OK)
async def add_justification(
    candidate_id: UUID,
    body: JustificationUpdate,
    current_user: Annotated[User, RecruiterOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.recruiter_justification = body.justification
    await AuditService.log(db, "candidate", candidate_id, "justification_added", current_user.id, {})
    return {"detail": "Justification saved"}


@router.post("/resumes/{candidate_id}/approve", status_code=status.HTTP_200_OK)
async def approve_candidate(
    candidate_id: UUID,
    current_user: Annotated[User, RecruiterOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Ensure all bias flags are acknowledged
    unack_result = await db.execute(
        select(BiasFlag).where(BiasFlag.candidate_id == candidate_id, BiasFlag.acknowledged_by == None)  # noqa: E711
    )
    unacknowledged = unack_result.scalars().all()
    if unacknowledged:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{len(unacknowledged)} bias flag(s) must be acknowledged before sign-off",
        )

    if candidate.status not in (CandidateStatus.scored, CandidateStatus.pending):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot shortlist a candidate with status '{candidate.status.value}'",
        )

    candidate.status = CandidateStatus.shortlisted
    await AuditService.log(db, "candidate", candidate_id, "approved", current_user.id, {})

    # Trigger shortlist email + Round 1 scheduling
    from app.workers.tasks import send_shortlist_email_task, schedule_round_task
    send_shortlist_email_task.delay(str(candidate_id))
    schedule_round_task.delay(str(candidate_id), 1)

    return {"detail": "Candidate approved and shortlisted"}


@router.post("/resumes/{candidate_id}/reject", status_code=status.HTTP_200_OK)
async def reject_candidate(
    candidate_id: UUID,
    body: RejectRequest,
    current_user: Annotated[User, RecruiterOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = CandidateStatus.rejected
    await AuditService.log(db, "candidate", candidate_id, "rejected", current_user.id, {"reason": body.reason})

    from app.workers.tasks import send_rejection_email_task
    send_rejection_email_task.delay(str(candidate_id))
    return {"detail": "Candidate rejected"}


@router.post("/resumes/{candidate_id}/decision", status_code=status.HTTP_200_OK)
async def final_decision(
    candidate_id: UUID,
    body: DecisionRequest,
    current_user: Annotated[User, RecruiterOnly],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.decision not in ("hire", "no_hire"):
        raise HTTPException(status_code=400, detail="Decision must be 'hire' or 'no_hire'")
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = CandidateStatus.hired if body.decision == "hire" else CandidateStatus.no_hire
    await AuditService.log(db, "candidate", candidate_id, f"decision_{body.decision}", current_user.id, {})
    return {"detail": f"Decision recorded: {body.decision}"}
