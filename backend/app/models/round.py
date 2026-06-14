import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RoundStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    rescheduled = "rescheduled"


class InterviewRound(Base):
    __tablename__ = "interview_rounds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    interviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interviewers.id"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_mins: Mapped[int] = mapped_column(Integer, default=60)
    teams_meeting_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    outlook_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[RoundStatus] = mapped_column(Enum(RoundStatus), default=RoundStatus.scheduled)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="interview_rounds")  # noqa: F821
    interviewer: Mapped["Interviewer"] = relationship("Interviewer", back_populates="interview_rounds")  # noqa: F821
    feedback: Mapped["InterviewFeedback | None"] = relationship("InterviewFeedback", back_populates="round", uselist=False)  # noqa: F821
