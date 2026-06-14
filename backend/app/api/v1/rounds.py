from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.candidate import Candidate
from app.models.feedback import InterviewFeedback, Recommendation
from app.models.interviewer import Interviewer
from app.models.job import JobPosting
from app.models.round import InterviewRound, RoundStatus
from app.models.user import User, UserRole
from app.schemas.round import FeedbackSubmit, InterviewerRoundOut, RoundOut
from app.services.audit_service import AuditService

router = APIRouter(tags=["rounds & feedback"])

ROUND_LABELS = {1: "Technical Screen", 2: "Technical Deep-Dive", 3: "Final Managerial"}


# ── Interviewer: list own assigned rounds ─────────────────────────────────────

@router.get("/rounds", response_model=list[InterviewerRoundOut])
async def list_my_rounds(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns all interview rounds assigned to the currently logged-in interviewer."""
    # Match by email — Interviewer profile is linked to User by email
    iv_result = await db.execute(
        select(Interviewer).where(Interviewer.email == current_user.email)
    )
    interviewer = iv_result.scalar_one_or_none()
    if not interviewer:
        # Non-interviewers (admin/recruiter) get all rounds overview
        if current_user.role in (UserRole.admin, UserRole.recruiter):
            result = await db.execute(
                select(InterviewRound).order_by(InterviewRound.scheduled_at.desc().nullslast())
            )
            rounds = result.scalars().all()
        else:
            return []
    else:
        result = await db.execute(
            select(InterviewRound)
            .where(InterviewRound.interviewer_id == interviewer.id)
            .order_by(InterviewRound.scheduled_at.desc().nullslast())
        )
        rounds = result.scalars().all()

    out = []
    for r in rounds:
        candidate_result = await db.execute(select(Candidate).where(Candidate.id == r.candidate_id))
        candidate = candidate_result.scalar_one_or_none()
        job_result = None
        job_title = None
        if candidate:
            job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
            job = job_result.scalar_one_or_none()
            job_title = job.title if job else None

        feedback_result = await db.execute(
            select(InterviewFeedback).where(InterviewFeedback.round_id == r.id)
        )
        feedback_submitted = feedback_result.scalar_one_or_none() is not None

        out.append(InterviewerRoundOut(
            id=str(r.id),
            round_number=r.round_number,
            candidate_name=candidate.name if candidate else None,
            job_title=job_title,
            scheduled_at=r.scheduled_at.isoformat() if r.scheduled_at else None,
            status=r.status.value if hasattr(r.status, "value") else str(r.status),
            feedback_submitted=feedback_submitted,
        ))
    return out


# ── Recruiter/Admin: rounds for a specific candidate ─────────────────────────

@router.get("/resumes/{candidate_id}/rounds", response_model=list[RoundOut])
async def list_rounds(
    candidate_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.recruiter, UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.candidate_id == candidate_id)
        .order_by(InterviewRound.round_number)
    )
    return result.scalars().all()


# ── Submit feedback ───────────────────────────────────────────────────────────

@router.post("/rounds/{round_id}/feedback", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    round_id: UUID,
    body: FeedbackSubmit,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(InterviewRound).where(InterviewRound.id == round_id))
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")

    existing = await db.execute(
        select(InterviewFeedback).where(InterviewFeedback.round_id == round_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Feedback already submitted for this round")

    # Look up interviewer profile from user email
    iv_result = await db.execute(
        select(Interviewer).where(Interviewer.email == current_user.email)
    )
    interviewer = iv_result.scalar_one_or_none()
    interviewer_id = interviewer.id if interviewer else round_.interviewer_id

    feedback = InterviewFeedback(
        round_id=round_id,
        interviewer_id=interviewer_id,
        technical_score=body.technical_score,
        communication_score=body.communication_score,
        problem_solving_score=body.problem_solving_score,
        cultural_fit_score=body.cultural_fit_score,
        comments=body.comments,
        recommendation=Recommendation(body.recommendation),
        strengths=body.strengths,
        weaknesses=body.weaknesses,
    )
    db.add(feedback)
    round_.status = RoundStatus.completed
    await db.flush()

    await AuditService.log(
        db, "interview_round", round_id, "feedback_submitted", current_user.id,
        {"recommendation": body.recommendation}
    )

    from app.workers.tasks import trigger_next_round_task
    trigger_next_round_task.delay(str(round_.candidate_id), round_.round_number)

    return {"detail": "Feedback submitted"}


# ── Aggregated feedback for recruiter view ────────────────────────────────────

@router.get("/resumes/{candidate_id}/feedback")
async def get_all_feedback(
    candidate_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.recruiter, UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(InterviewRound, InterviewFeedback)
        .join(InterviewFeedback, InterviewFeedback.round_id == InterviewRound.id, isouter=True)
        .where(InterviewRound.candidate_id == candidate_id)
        .order_by(InterviewRound.round_number)
    )
    rows = result.all()
    return [
        {
            "round_number": r.round_number,
            "round_label": ROUND_LABELS.get(r.round_number, f"Round {r.round_number}"),
            "scheduled_at": r.scheduled_at.isoformat() if r.scheduled_at else None,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "teams_meeting_url": r.teams_meeting_url,
            "feedback": {
                "technical_score": f.technical_score,
                "communication_score": f.communication_score,
                "problem_solving_score": f.problem_solving_score,
                "cultural_fit_score": f.cultural_fit_score,
                "comments": f.comments,
                "recommendation": f.recommendation.value if hasattr(f.recommendation, "value") else str(f.recommendation),
                "strengths": f.strengths or [],
                "weaknesses": f.weaknesses or [],
            } if f else None,
        }
        for r, f in rows
    ]


# ── Audit trail ───────────────────────────────────────────────────────────────

@router.get("/resumes/{candidate_id}/audit")
async def get_audit_trail(
    candidate_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.recruiter, UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.audit import AuditLog
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_id == candidate_id)
        .order_by(AuditLog.created_at)
    )
    logs = result.scalars().all()
    return [
        {
            "action": l.action,
            "performed_by": str(l.performed_by),
            "at": l.created_at.isoformat(),
            "payload": l.payload,
        }
        for l in logs
    ]
