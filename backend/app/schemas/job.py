from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ScoringWeights(BaseModel):
    skills_match: int = Field(default=35, ge=0, le=100)
    role_relevance: int = Field(default=25, ge=0, le=100)
    years_experience: int = Field(default=20, ge=0, le=100)
    education: int = Field(default=10, ge=0, le=100)
    career_progression: int = Field(default=5, ge=0, le=100)
    certifications: int = Field(default=5, ge=0, le=100)

    @model_validator(mode="after")
    def weights_must_sum_to_100(self) -> "ScoringWeights":
        total = (
            self.skills_match + self.role_relevance + self.years_experience
            + self.education + self.career_progression + self.certifications
        )
        if total != 100:
            raise ValueError(f"Scoring weights must sum to 100, got {total}")
        return self


class JobCreate(BaseModel):
    title: str
    department: str | None = None
    structured_jd: dict[str, Any] = Field(default_factory=dict)
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    shortlist_threshold: int = Field(default=60, ge=0, le=100)
    shortlist_top_percent: int = Field(default=20, ge=1, le=100)


class JobUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    structured_jd: dict[str, Any] | None = None
    scoring_weights: ScoringWeights | None = None
    shortlist_threshold: int | None = Field(default=None, ge=0, le=100)
    shortlist_top_percent: int | None = Field(default=None, ge=1, le=100)
    status: str | None = None  # active | closed | draft


class JobOut(BaseModel):
    id: UUID
    title: str
    department: str | None = None
    structured_jd: dict[str, Any]
    scoring_weights: dict[str, Any]
    shortlist_threshold: int
    status: str
    created_by: UUID
    created_at: Any

    model_config = {"from_attributes": True}
