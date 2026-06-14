from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class RoundOut(BaseModel):
    id: UUID
    candidate_id: UUID
    interviewer_id: UUID
    round_number: int
    scheduled_at: datetime | None
    duration_mins: int
    teams_meeting_url: str | None
    status: str

    model_config = {"from_attributes": True}


class InterviewerRoundOut(BaseModel):
    """For the interviewer's own rounds list."""
    id: str
    round_number: int
    candidate_name: str | None
    job_title: str | None
    scheduled_at: str | None
    status: str
    feedback_submitted: bool


class FeedbackSubmit(BaseModel):
    technical_score: int = Field(ge=1, le=10)
    communication_score: int = Field(ge=1, le=10)
    problem_solving_score: int = Field(ge=1, le=10)
    cultural_fit_score: int = Field(ge=1, le=10)
    recommendation: str  # hire | no_hire | maybe
    comments: str
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)


class BiasAckRequest(BaseModel):
    comment: str | None = None
