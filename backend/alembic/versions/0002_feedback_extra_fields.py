"""Add problem_solving_score, strengths, weaknesses to interview_feedback

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "interview_feedback",
        sa.Column("problem_solving_score", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "interview_feedback",
        sa.Column("strengths", ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "interview_feedback",
        sa.Column("weaknesses", ARRAY(sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("interview_feedback", "weaknesses")
    op.drop_column("interview_feedback", "strengths")
    op.drop_column("interview_feedback", "problem_solving_score")
