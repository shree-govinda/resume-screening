import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CandidateStatus(str, enum.Enum):
    pending = "pending"
    parsing = "parsing"
    scored = "scored"
    shortlisted = "shortlisted"
    rejected = "rejected"
    hired = "hired"
    no_hire = "no_hire"
    parse_error = "parse_error"


class CandidateSource(str, enum.Enum):
    portal = "portal"
    api = "api"


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_posting_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_postings.id"), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    resume_file_url: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    total_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    score_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    score_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CandidateStatus] = mapped_column(Enum(CandidateStatus), default=CandidateStatus.pending)
    recruiter_justification: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[CandidateSource] = mapped_column(Enum(CandidateSource), default=CandidateSource.portal)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    job_posting: Mapped["JobPosting"] = relationship("JobPosting", back_populates="candidates")  # noqa: F821
    bias_flags: Mapped[list["BiasFlag"]] = relationship("BiasFlag", back_populates="candidate")  # noqa: F821
    interview_rounds: Mapped[list["InterviewRound"]] = relationship("InterviewRound", back_populates="candidate")  # noqa: F821
