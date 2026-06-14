import os
import uuid
from typing import Annotated, Any
from uuid import UUID

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_api_key_user, get_current_user, require_role
from app.models.bias_flag import BiasFlag
from app.models.candidate import Candidate, CandidateSource, CandidateStatus
from app.models.job import JobPosting
from app.models.user import User, UserRole
from app.schemas.candidate import CandidateStatusResponse

router = APIRouter(tags=["resumes"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
MAX_FILE_SIZE_MB = 10


async def _save_file(file: UploadFile) -> str:
    os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[-1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(settings.LOCAL_UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")
        await f.write(content)
    return path


async def _create_candidate(db, job_id, file_url, source) -> Candidate:
    candidate = Candidate(
        job_posting_id=job_id,
        resume_file_url=file_url,
        status=CandidateStatus.pending,
        source=source,
    )
    db.add(candidate)
    await db.flush()
    return candidate


def _normalize_score_breakdown(raw: dict | None) -> dict:
    """Normalize score_breakdown regardless of storage format (flat vs nested)."""
    if not raw:
        return {}
    # New format: flat keys + optional _explanations sub-key
    if "skills_match" in raw:
        return {k: v for k, v in raw.items() if not k.startswith("_")}
    # Legacy format: {"scores": {...}, "explanations": {...}}
    if "scores" in raw:
        return raw["scores"]
    return raw


def _serialize_candidate(candidate: Candidate, bias_flags: list[BiasFlag]) -> dict[str, Any]:
    score_breakdown = _normalize_score_breakdown(candidate.score_breakdown)
    return {
        "id": str(candidate.id),
        "candidate_name": candidate.name,
        "email": candidate.email,
        "status": candidate.status.value if hasattr(candidate.status, "value") else candidate.status,
        "total_score": float(candidate.total_score) if candidate.total_score is not None else None,
        "score_breakdown": score_breakdown,
        "score_explanation": candidate.score_explanation,
        "bias_flags": [
            {
                "id": str(f.id),
                "flag_type": f.flag_type.value if hasattr(f.flag_type, "value") else f.flag_type,
                "severity": f.severity.value if hasattr(f.severity, "value") else f.severity,
                "explanation": f.description,
                "acknowledged": f.acknowledged_by is not None,
                "ack_comment": f.ack_comment,
            }
            for f in bias_flags
        ],
        "justification": candidate.recruiter_justification,
        "source": candidate.source.value if hasattr(candidate.source, "value") else candidate.source,
        "created_at": candidate.submitted_at.isoformat() if candidate.submitted_at else None,
    }


# ── HR Portal Upload ──────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/resumes", status_code=status.HTTP_202_ACCEPTED)
async def upload_resume(
    job_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    file_url = await _save_file(file)
    candidate = await _create_candidate(db, job_id, file_url, CandidateSource.portal)

    from app.workers.tasks import parse_resume_task
    parse_resume_task.delay(str(candidate.id))

    return {"candidate_id": str(candidate.id), "status": "queued"}


# ── Third-Party API ───────────────────────────────────────────────────────────

@router.post("/v1/resumes", status_code=status.HTTP_202_ACCEPTED)
async def submit_resume_api(
    job_id: UUID,
    file: UploadFile = File(...),
    api_user: User = Depends(get_api_key_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    file_url = await _save_file(file)
    candidate = await _create_candidate(db, job_id, file_url, CandidateSource.api)

    from app.workers.tasks import parse_resume_task
    parse_resume_task.delay(str(candidate.id))

    return {"candidate_id": str(candidate.id), "status": "queued"}


# ── Status Polling ────────────────────────────────────────────────────────────

@router.get("/resumes/{candidate_id}/status", response_model=CandidateStatusResponse)
async def get_resume_status(
    candidate_id: UUID,
    current_user: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return CandidateStatusResponse(
        id=candidate.id,
        status=candidate.status,
        total_score=float(candidate.total_score) if candidate.total_score else None,
    )


# ── Candidate List (full data for recruiter dashboard) ────────────────────────

@router.get("/jobs/{job_id}/candidates")
async def list_candidates(
    job_id: UUID,
    current_user: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Candidate)
        .where(Candidate.job_posting_id == job_id)
        .order_by(Candidate.total_score.desc().nullslast())
    )
    candidates = result.scalars().all()

    out = []
    for c in candidates:
        flags_result = await db.execute(
            select(BiasFlag).where(BiasFlag.candidate_id == c.id).order_by(BiasFlag.created_at)
        )
        flags = flags_result.scalars().all()
        out.append(_serialize_candidate(c, flags))
    return out


# ── Retry Failed Parse ───────────────────────────────────────────────────────

@router.post("/resumes/{candidate_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_parse(
    candidate_id: UUID,
    current_user: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status != CandidateStatus.parse_error:
        raise HTTPException(status_code=400, detail="Candidate is not in parse_error status")
    candidate.status = CandidateStatus.pending
    await db.flush()
    from app.workers.tasks import parse_resume_task
    parse_resume_task.delay(str(candidate_id))
    return {"detail": "Re-queued for parsing"}


# ── Candidate Detail ──────────────────────────────────────────────────────────

@router.get("/resumes/{candidate_id}")
async def get_candidate(
    candidate_id: UUID,
    current_user: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    flags_result = await db.execute(
        select(BiasFlag).where(BiasFlag.candidate_id == candidate_id).order_by(BiasFlag.created_at)
    )
    return _serialize_candidate(candidate, flags_result.scalars().all())
