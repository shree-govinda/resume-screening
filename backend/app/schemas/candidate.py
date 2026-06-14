from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CandidateStatusResponse(BaseModel):
    id: UUID
    status: str
    total_score: float | None = None


class CandidateListItem(BaseModel):
    id: UUID
    name: str | None
    email: str | None
    total_score: float | None
    status: str
    bias_flag_count: int = 0
    source: str

    model_config = {"from_attributes": True}


class CandidateDetail(BaseModel):
    id: UUID
    job_posting_id: UUID
    name: str | None
    email: str | None
    resume_file_url: str
    parsed_data: dict[str, Any]
    total_score: float | None
    score_breakdown: dict[str, Any]
    score_explanation: str | None
    status: str
    recruiter_justification: str | None
    source: str

    model_config = {"from_attributes": True}


class JustificationUpdate(BaseModel):
    justification: str


class RejectRequest(BaseModel):
    reason: str | None = None


class DecisionRequest(BaseModel):
    decision: str  # "hire" or "no_hire"
