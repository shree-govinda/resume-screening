import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BiasFlagType(str, enum.Enum):
    gender_inference = "gender_inference"
    name_ethnicity = "name_ethnicity"
    age_inference = "age_inference"
    employment_gap = "employment_gap"
    institution_prestige = "institution_prestige"
    over_qualification = "over_qualification"
    geographic = "geographic"


class BiasSeverity(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class BiasFlag(Base):
    __tablename__ = "bias_flags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    flag_type: Mapped[BiasFlagType] = mapped_column(Enum(BiasFlagType), nullable=False)
    severity: Mapped[BiasSeverity] = mapped_column(Enum(BiasSeverity), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ack_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="bias_flags")  # noqa: F821
    acknowledger: Mapped["User | None"] = relationship("User")  # noqa: F821
