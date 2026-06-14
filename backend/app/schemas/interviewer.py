from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class InterviewerCreate(BaseModel):
    name: str
    email: EmailStr
    department: str | None = None
    outlook_user_id: str | None = None
    skills: list[str] = []
    eligible_rounds: list[int] = Field(default=[1, 2, 3])
    max_interviews_per_week: int = Field(default=5, ge=1)


class InterviewerUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    skills: list[str] | None = None
    eligible_rounds: list[int] | None = None
    max_interviews_per_week: int | None = None
    is_active: bool | None = None
    outlook_user_id: str | None = None


class InterviewerOut(BaseModel):
    id: UUID
    name: str
    email: str
    department: str | None = None
    skills: list[str]
    eligible_rounds: list[int]
    max_interviews_per_week: int
    is_active: bool

    model_config = {"from_attributes": True}
