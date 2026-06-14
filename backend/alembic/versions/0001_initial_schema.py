"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("role", sa.Enum("admin", "recruiter", "interviewer", name="userrole"), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("api_key_hash", sa.String(255), nullable=True, unique=True),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "job_postings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description_text", sa.Text, nullable=True),
        sa.Column("structured_jd", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("scoring_weights", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("shortlist_threshold", sa.Integer, default=60),
        sa.Column("shortlist_top_percent", sa.Integer, default=20),
        sa.Column("status", sa.Enum("draft", "active", "closed", name="jobstatus"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_posting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("job_postings.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("resume_file_url", sa.Text, nullable=False),
        sa.Column("parsed_data", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("total_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("score_breakdown", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("score_explanation", sa.Text, nullable=True),
        sa.Column("status", sa.Enum(
            "pending", "parsing", "scored", "shortlisted", "rejected", "hired", "no_hire", "parse_error",
            name="candidatestatus"
        ), nullable=False),
        sa.Column("recruiter_justification", sa.Text, nullable=True),
        sa.Column("source", sa.Enum("portal", "api", name="candidatesource"), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_candidates_job_posting_id", "candidates", ["job_posting_id"])
    op.create_index("ix_candidates_email", "candidates", ["email"])

    op.create_table(
        "bias_flags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("flag_type", sa.Enum(
            "gender_inference", "name_ethnicity", "age_inference", "employment_gap",
            "institution_prestige", "over_qualification", "geographic", name="biasflagtype"
        ), nullable=False),
        sa.Column("severity", sa.Enum("high", "medium", "low", name="biasseverity"), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("recommendation", sa.Text, nullable=True),
        sa.Column("acknowledged_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ack_comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bias_flags_candidate_id", "bias_flags", ["candidate_id"])

    op.create_table(
        "interviewers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("outlook_user_id", sa.String(255), nullable=True),
        sa.Column("skills", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("eligible_rounds", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("max_interviews_per_week", sa.Integer, default=5),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interviewers_email", "interviewers", ["email"])

    op.create_table(
        "interview_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("interviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interviewers.id"), nullable=False),
        sa.Column("round_number", sa.Integer, nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_mins", sa.Integer, default=60),
        sa.Column("teams_meeting_url", sa.Text, nullable=True),
        sa.Column("outlook_event_id", sa.String(255), nullable=True),
        sa.Column("status", sa.Enum("scheduled", "completed", "cancelled", "rescheduled", name="roundstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interview_rounds_candidate_id", "interview_rounds", ["candidate_id"])

    op.create_table(
        "interview_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("round_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_rounds.id"), nullable=False, unique=True),
        sa.Column("interviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interviewers.id"), nullable=False),
        sa.Column("technical_score", sa.Integer, nullable=False),
        sa.Column("communication_score", sa.Integer, nullable=False),
        sa.Column("cultural_fit_score", sa.Integer, nullable=False),
        sa.Column("comments", sa.Text, nullable=True),
        sa.Column("recommendation", sa.Enum("hire", "no_hire", "maybe", name="recommendation"), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("performed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_log_entity_type", "audit_log", ["entity_type"])
    op.create_index("ix_audit_log_entity_id", "audit_log", ["entity_id"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("interview_feedback")
    op.drop_table("interview_rounds")
    op.drop_table("interviewers")
    op.drop_table("bias_flags")
    op.drop_table("candidates")
    op.drop_table("job_postings")
    op.drop_table("users")
