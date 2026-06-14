import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class JobStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    closed = "closed"


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    structured_jd: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    scoring_weights: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    shortlist_threshold: Mapped[int] = mapped_column(Integer, default=60)
    shortlist_top_percent: Mapped[int] = mapped_column(Integer, default=20)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.active)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    candidates: Mapped[list["Candidate"]] = relationship("Candidate", back_populates="job_posting")  # noqa: F821
    creator: Mapped["User"] = relationship("User")  # noqa: F821
