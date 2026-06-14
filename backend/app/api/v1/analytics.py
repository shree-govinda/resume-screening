"""
Analytics & reporting API for the recruiter/admin dashboard.
All queries are read-only aggregations — no data mutation here.
"""
from typing import Annotated
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.bias_flag import BiasFlag, BiasFlagType, BiasSeverity
from app.models.candidate import Candidate, CandidateStatus
from app.models.feedback import InterviewFeedback, Recommendation
from app.models.interviewer import Interviewer
from app.models.job import JobPosting
from app.models.round import InterviewRound, RoundStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/analytics", tags=["analytics"])

RecruiterOrAdmin = Depends(require_role(UserRole.recruiter, UserRole.admin))


@router.get("/overview")
async def get_overview(
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Top-level KPIs for the reporting dashboard."""

    # Total candidates by status
    status_rows = await db.execute(
        select(Candidate.status, func.count().label("count"))
        .group_by(Candidate.status)
    )
    by_status = {row.status.value if hasattr(row.status, "value") else str(row.status): row.count
                 for row in status_rows.all()}

    total = sum(by_status.values())
    shortlisted = by_status.get("shortlisted", 0)
    hired = by_status.get("hired", 0)
    rejected = by_status.get("rejected", 0) + by_status.get("no_hire", 0)

    # Average score (only scored candidates)
    avg_score_row = await db.execute(
        select(func.avg(Candidate.total_score)).where(Candidate.total_score.isnot(None))
    )
    avg_score = avg_score_row.scalar()

    # Shortlist rate
    scored_total = sum(by_status.get(s, 0) for s in ["scored", "shortlisted", "hired", "no_hire", "rejected"])
    shortlist_rate = round((shortlisted + hired) / scored_total * 100, 1) if scored_total else 0

    # Active jobs
    active_jobs_row = await db.execute(
        select(func.count()).where(JobPosting.status == "active")
    )
    active_jobs = active_jobs_row.scalar() or 0

    # Interviews scheduled this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    interviews_row = await db.execute(
        select(func.count()).where(InterviewRound.scheduled_at >= week_ago)
    )
    interviews_this_week = interviews_row.scalar() or 0

    # Bias flags summary
    bias_rows = await db.execute(
        select(BiasFlag.severity, func.count().label("count"))
        .where(BiasFlag.acknowledged_by.is_(None))
        .group_by(BiasFlag.severity)
    )
    unacked_bias = {row.severity.value if hasattr(row.severity, "value") else str(row.severity): row.count
                   for row in bias_rows.all()}

    return {
        "total_candidates": total,
        "by_status": by_status,
        "avg_score": round(float(avg_score), 1) if avg_score else None,
        "shortlist_rate_pct": shortlist_rate,
        "active_jobs": active_jobs,
        "interviews_this_week": interviews_this_week,
        "hired": hired,
        "rejected": rejected,
        "unacknowledged_bias_flags": unacked_bias,
    }


@router.get("/pipeline")
async def get_pipeline(
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Funnel data: how many candidates pass each stage."""
    statuses = ["pending", "parsing", "scored", "shortlisted", "hired", "rejected", "no_hire", "parse_error"]
    rows = await db.execute(
        select(Candidate.status, func.count().label("count")).group_by(Candidate.status)
    )
    counts = {row.status.value if hasattr(row.status, "value") else str(row.status): row.count
              for row in rows.all()}
    return [{"stage": s, "count": counts.get(s, 0)} for s in statuses]


@router.get("/scores")
async def get_score_distribution(
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Score distribution in buckets of 10."""
    rows = await db.execute(
        select(Candidate.total_score).where(Candidate.total_score.isnot(None))
    )
    scores = [float(r[0]) for r in rows.all()]
    buckets = {f"{i}-{i+10}": 0 for i in range(0, 100, 10)}
    for s in scores:
        bucket = f"{int(s // 10) * 10}-{int(s // 10) * 10 + 10}"
        if bucket in buckets:
            buckets[bucket] += 1
    return [{"range": k, "count": v} for k, v in buckets.items()]


@router.get("/bias")
async def get_bias_summary(
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Bias flag breakdown by type."""
    rows = await db.execute(
        select(BiasFlag.flag_type, BiasFlag.severity, func.count().label("count"))
        .group_by(BiasFlag.flag_type, BiasFlag.severity)
        .order_by(func.count().desc())
    )
    return [
        {
            "flag_type": row.flag_type.value if hasattr(row.flag_type, "value") else str(row.flag_type),
            "severity": row.severity.value if hasattr(row.severity, "value") else str(row.severity),
            "count": row.count,
        }
        for row in rows.all()
    ]


@router.get("/interviewers")
async def get_interviewer_load(
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Per-interviewer interview counts and hire recommendation rates."""
    rows = await db.execute(
        select(
            Interviewer.name,
            Interviewer.department,
            func.count(InterviewRound.id).label("total_interviews"),
            func.sum(
                case((InterviewFeedback.recommendation == Recommendation.hire, 1), else_=0)
            ).label("hire_recs"),
        )
        .outerjoin(InterviewRound, InterviewRound.interviewer_id == Interviewer.id)
        .outerjoin(InterviewFeedback, InterviewFeedback.round_id == InterviewRound.id)
        .group_by(Interviewer.id, Interviewer.name, Interviewer.department)
        .order_by(func.count(InterviewRound.id).desc())
    )
    return [
        {
            "name": r.name,
            "department": r.department,
            "total_interviews": r.total_interviews or 0,
            "hire_recommendations": int(r.hire_recs or 0),
        }
        for r in rows.all()
    ]


@router.get("/jobs")
async def get_jobs_summary(
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Per-job candidate funnel summary."""
    rows = await db.execute(
        select(
            JobPosting.id,
            JobPosting.title,
            JobPosting.status,
            func.count(Candidate.id).label("total"),
            func.avg(Candidate.total_score).label("avg_score"),
            func.sum(case((Candidate.status == CandidateStatus.shortlisted, 1), else_=0)).label("shortlisted"),
            func.sum(case((Candidate.status == CandidateStatus.hired, 1), else_=0)).label("hired"),
        )
        .outerjoin(Candidate, Candidate.job_posting_id == JobPosting.id)
        .group_by(JobPosting.id, JobPosting.title, JobPosting.status)
        .order_by(func.count(Candidate.id).desc())
    )
    return [
        {
            "id": str(r.id),
            "title": r.title,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "total_candidates": r.total or 0,
            "avg_score": round(float(r.avg_score), 1) if r.avg_score else None,
            "shortlisted": int(r.shortlisted or 0),
            "hired": int(r.hired or 0),
        }
        for r in rows.all()
    ]
