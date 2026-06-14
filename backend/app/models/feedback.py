import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Recommendation(str, enum.Enum):
    hire = "hire"
    no_hire = "no_hire"
    maybe = "maybe"


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_rounds.id"), nullable=False, unique=True)
    interviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interviewers.id"), nullable=False)
    technical_score: Mapped[int] = mapped_column(Integer, nullable=False)
    communication_score: Mapped[int] = mapped_column(Integer, nullable=False)
    problem_solving_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default="5")
    cultural_fit_score: Mapped[int] = mapped_column(Integer, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[Recommendation] = mapped_column(Enum(Recommendation), nullable=False)
    strengths: Mapped[list | None] = mapped_column(ARRAY(Text), nullable=True)
    weaknesses: Mapped[list | None] = mapped_column(ARRAY(Text), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    round: Mapped["InterviewRound"] = relationship("InterviewRound", back_populates="feedback")  # noqa: F821
    interviewer: Mapped["Interviewer"] = relationship("Interviewer")  # noqa: F821
