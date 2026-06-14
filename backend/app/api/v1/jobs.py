from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.job import JobPosting, JobStatus
from app.models.user import User, UserRole
from app.schemas.job import JobCreate, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])

RecruiterOrAdmin = Depends(require_role(UserRole.recruiter, UserRole.admin))


def _serialize_job(job: JobPosting) -> dict[str, Any]:
    jd = job.structured_jd or {}
    return {
        "id": str(job.id),
        "title": job.title,
        "department": jd.get("department"),
        "structured_jd": jd,
        "scoring_weights": job.scoring_weights or {},
        "shortlist_threshold": job.shortlist_threshold,
        "status": job.status.value if hasattr(job.status, "value") else str(job.status),
        "created_by": str(job.created_by),
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreate,
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Merge top-level department into structured_jd so it's stored in JSONB
    jd_data = dict(body.structured_jd)
    if body.department:
        jd_data["department"] = body.department

    job = JobPosting(
        title=body.title,
        structured_jd=jd_data,
        scoring_weights=body.scoring_weights.model_dump(),
        shortlist_threshold=body.shortlist_threshold,
        shortlist_top_percent=body.shortlist_top_percent,
        status=JobStatus.active,
        created_by=current_user.id,
    )
    db.add(job)
    await db.flush()
    return _serialize_job(job)


@router.get("")
async def list_jobs(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
):
    query = select(JobPosting)
    if status_filter:
        query = query.where(JobPosting.status == status_filter)
    result = await db.execute(query.order_by(JobPosting.created_at.desc()))
    return [_serialize_job(j) for j in result.scalars().all()]


@router.get("/{job_id}")
async def get_job(
    job_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _serialize_job(job)


@router.patch("/{job_id}")
async def update_job(
    job_id: UUID,
    body: JobUpdate,
    current_user: Annotated[User, RecruiterOrAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if body.title is not None:
        job.title = body.title
    if body.structured_jd is not None or body.department is not None:
        jd_data = dict(job.structured_jd or {})
        if body.structured_jd is not None:
            jd_data.update(body.structured_jd)
        if body.department is not None:
            jd_data["department"] = body.department
        job.structured_jd = jd_data
    if body.scoring_weights is not None:
        job.scoring_weights = body.scoring_weights.model_dump()
    if body.shortlist_threshold is not None:
        job.shortlist_threshold = body.shortlist_threshold
    if body.shortlist_top_percent is not None:
        job.shortlist_top_percent = body.shortlist_top_percent
    if body.status is not None:
        allowed = {s.value for s in JobStatus}
        if body.status not in allowed:
            raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
        job.status = JobStatus(body.status)

    return _serialize_job(job)
