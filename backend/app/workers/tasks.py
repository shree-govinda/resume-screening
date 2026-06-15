import asyncio
import logging
from datetime import datetime, timezone, timedelta
from uuid import UUID

from app.workers.celery_app import celery_app

log = logging.getLogger(__name__)
ROUND_LABELS = {1: "Technical Screen", 2: "Technical Deep-Dive", 3: "Final Managerial"}


def run_async(coro):
    return asyncio.run(coro)


@celery_app.task(name="app.workers.tasks.parse_resume_task", bind=True, max_retries=3)
def parse_resume_task(self, candidate_id: str):
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.candidate import Candidate, CandidateStatus
    from app.models.bias_flag import BiasFlag, BiasFlagType, BiasSeverity
    from app.services.resume_parser import extract_text
    from app.services.ai_service import ai_service
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Candidate).where(Candidate.id == UUID(candidate_id)))
            candidate = result.scalar_one_or_none()
            if not candidate:
                return

            candidate.status = CandidateStatus.parsing
            await db.commit()

            try:
                raw_text = extract_text(candidate.resume_file_url)

                parsed = await ai_service.extract_resume(raw_text)
                candidate.parsed_data = parsed
                candidate.name = parsed.get("name")
                candidate.email = parsed.get("email")

                from app.models.job import JobPosting
                job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
                job = job_result.scalar_one()

                score_result = await ai_service.score_candidate(parsed, job.structured_jd, job.scoring_weights)
                scores = score_result.get("scores", {})
                weights = job.scoring_weights

                # Weighted total computed in backend — not trusted from LLM
                total = sum(
                    scores.get(k, 0) * (weights.get(k, 0) / 100)
                    for k in ["skills_match", "role_relevance", "years_experience",
                               "education", "career_progression", "certifications"]
                )
                # Store flat score keys + explanations sub-key
                candidate.score_breakdown = {
                    **scores,
                    "_explanations": score_result.get("explanations", {}),
                }
                candidate.total_score = round(total, 2)
                candidate.score_explanation = score_result.get("summary", "")

                flags = await ai_service.detect_bias(parsed, job.structured_jd, scores)
                for flag in flags:
                    try:
                        db.add(BiasFlag(
                            candidate_id=candidate.id,
                            flag_type=BiasFlagType(flag["type"]),
                            severity=BiasSeverity(flag.get("severity", "low")),
                            description=flag.get("description", flag.get("explanation", "")),
                            recommendation=flag.get("recommendation"),
                        ))
                    except Exception:
                        pass

                candidate.status = CandidateStatus.scored
                await db.commit()

            except Exception as exc:
                candidate.status = CandidateStatus.parse_error
                await db.commit()
                raise self.retry(exc=exc, countdown=30)

    run_async(_run())


@celery_app.task(name="app.workers.tasks.schedule_round_task")
def schedule_round_task(candidate_id: str, round_number: int):
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.models.interviewer import Interviewer
    from app.models.round import InterviewRound, RoundStatus
    from app.services.ai_service import ai_service
    from app.services.graph_service import graph_service
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Candidate).where(Candidate.id == UUID(candidate_id)))
            candidate = result.scalar_one_or_none()
            if not candidate:
                return
            from app.models.candidate import CandidateStatus
            if candidate.status not in (CandidateStatus.shortlisted,):
                log.info("Skipping round %d scheduling — candidate %s has status %s", round_number, candidate_id, candidate.status)
                return

            iv_result = await db.execute(
                select(Interviewer).where(Interviewer.is_active == True)  # noqa: E712
            )
            all_ivs = iv_result.scalars().all()
            eligible = [iv for iv in all_ivs if round_number in (iv.eligible_rounds or [])]
            if not eligible:
                log.warning("No eligible interviewers for round %d, candidate %s", round_number, candidate_id)
                return

            candidate_skills = (candidate.parsed_data or {}).get("skills", [])
            iv_data = [{"interviewer_id": str(iv.id), "name": iv.name, "skills": iv.skills} for iv in eligible]
            ranked = await ai_service.match_interviewers(candidate_skills, iv_data)

            selected_iv_id = ranked[0]["interviewer_id"] if ranked else str(eligible[0].id)
            selected_iv = next((iv for iv in eligible if str(iv.id) == selected_iv_id), eligible[0])

            # Schedule time (next business day offset by round)
            scheduled_at = graph_service.default_scheduled_time(round_number)

            # Create Teams meeting
            from app.models.job import JobPosting
            job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
            job = job_result.scalar_one()

            round_label = graph_service.round_label(round_number)
            subject = f"Interview: {candidate.name or 'Candidate'} — {job.title} ({round_label})"

            attendees = [selected_iv.email]
            if candidate.email:
                attendees.append(candidate.email)

            teams_url = await graph_service.create_teams_meeting(
                organizer_email=selected_iv.email,
                attendee_emails=attendees,
                subject=subject,
                start_dt=scheduled_at,
                duration_mins=60,
            )

            round_ = InterviewRound(
                candidate_id=candidate.id,
                interviewer_id=selected_iv.id,
                round_number=round_number,
                status=RoundStatus.scheduled,
                duration_mins=60,
                scheduled_at=scheduled_at,
                teams_meeting_url=teams_url,
            )
            db.add(round_)
            await db.commit()
            await db.refresh(round_)

            send_interview_invite_task.delay(str(round_.id))
            send_iv_assignment_task.delay(str(round_.id))

    run_async(_run())


@celery_app.task(name="app.workers.tasks.trigger_next_round_task")
def trigger_next_round_task(candidate_id: str, completed_round: int):
    if completed_round < 3:
        schedule_round_task.delay(candidate_id, completed_round + 1)


@celery_app.task(name="app.workers.tasks.send_shortlist_email_task")
def send_shortlist_email_task(candidate_id: str):
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.models.job import JobPosting
    from app.services.email_service import email_service
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Candidate).where(Candidate.id == UUID(candidate_id)))
            candidate = result.scalar_one_or_none()
            if not candidate or not candidate.email:
                return
            job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
            job = job_result.scalar_one()
            email_service.send_shortlist_notification(
                candidate_name=candidate.name or "Candidate",
                candidate_email=candidate.email,
                job_title=job.title,
            )

    run_async(_run())


@celery_app.task(name="app.workers.tasks.send_rejection_email_task")
def send_rejection_email_task(candidate_id: str):
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.models.job import JobPosting
    from app.services.email_service import email_service
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Candidate).where(Candidate.id == UUID(candidate_id)))
            candidate = result.scalar_one_or_none()
            if not candidate or not candidate.email:
                return
            job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
            job = job_result.scalar_one()
            email_service.send_rejection_notification(
                candidate_name=candidate.name or "Candidate",
                candidate_email=candidate.email,
                job_title=job.title,
            )

    run_async(_run())


@celery_app.task(name="app.workers.tasks.send_interview_invite_task")
def send_interview_invite_task(round_id: str):
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.models.interviewer import Interviewer
    from app.models.job import JobPosting
    from app.models.round import InterviewRound
    from app.services.email_service import email_service
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(InterviewRound).where(InterviewRound.id == UUID(round_id)))
            round_ = result.scalar_one_or_none()
            if not round_ or not round_.scheduled_at:
                return

            candidate_result = await db.execute(select(Candidate).where(Candidate.id == round_.candidate_id))
            candidate = candidate_result.scalar_one()
            if not candidate.email:
                return

            job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
            job = job_result.scalar_one()

            round_label = ROUND_LABELS.get(round_.round_number, f"Round {round_.round_number}")
            email_service.send_interview_invite(
                candidate_name=candidate.name or "Candidate",
                candidate_email=candidate.email,
                job_title=job.title,
                round_number=round_.round_number,
                round_label=round_label,
                scheduled_at=round_.scheduled_at,
                duration_mins=round_.duration_mins,
                teams_url=round_.teams_meeting_url,
            )

    run_async(_run())


@celery_app.task(name="app.workers.tasks.send_iv_assignment_task")
def send_iv_assignment_task(round_id: str):
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.models.interviewer import Interviewer
    from app.models.job import JobPosting
    from app.models.round import InterviewRound
    from app.services.email_service import email_service
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(InterviewRound).where(InterviewRound.id == UUID(round_id)))
            round_ = result.scalar_one_or_none()
            if not round_ or not round_.scheduled_at:
                return

            candidate_result = await db.execute(select(Candidate).where(Candidate.id == round_.candidate_id))
            candidate = candidate_result.scalar_one()

            iv_result = await db.execute(select(Interviewer).where(Interviewer.id == round_.interviewer_id))
            interviewer = iv_result.scalar_one()

            job_result = await db.execute(select(JobPosting).where(JobPosting.id == candidate.job_posting_id))
            job = job_result.scalar_one()

            round_label = ROUND_LABELS.get(round_.round_number, f"Round {round_.round_number}")
            email_service.send_interviewer_assignment(
                interviewer_name=interviewer.name,
                interviewer_email=interviewer.email,
                candidate_name=candidate.name or "Candidate",
                job_title=job.title,
                round_number=round_.round_number,
                round_label=round_label,
                scheduled_at=round_.scheduled_at,
                duration_mins=round_.duration_mins,
                teams_url=round_.teams_meeting_url,
            )

    run_async(_run())


@celery_app.task(name="app.workers.tasks.feedback_reminder_task")
def feedback_reminder_task():
    """Celery Beat task — runs every hour, reminds interviewers with overdue feedback."""
    from app.core.database import CelerySessionLocal as AsyncSessionLocal
    from app.models.feedback import InterviewFeedback
    from app.models.interviewer import Interviewer
    from app.models.candidate import Candidate
    from app.models.round import InterviewRound, RoundStatus
    from app.services.email_service import email_service
    from sqlalchemy import select, and_

    async def _run():
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(InterviewRound).where(
                    and_(
                        InterviewRound.status == RoundStatus.scheduled,
                        InterviewRound.scheduled_at <= cutoff,
                    )
                )
            )
            overdue_rounds = result.scalars().all()

            for round_ in overdue_rounds:
                existing = await db.scalar(
                    select(InterviewFeedback).where(InterviewFeedback.round_id == round_.id)
                )
                if existing:
                    continue  # feedback already submitted

                iv_result = await db.execute(select(Interviewer).where(Interviewer.id == round_.interviewer_id))
                interviewer = iv_result.scalar_one_or_none()
                if not interviewer:
                    continue

                candidate_result = await db.execute(
                    select(Candidate).where(Candidate.id == round_.candidate_id)
                )
                candidate = candidate_result.scalar_one_or_none()
                round_label = ROUND_LABELS.get(round_.round_number, f"Round {round_.round_number}")
                email_service.send_feedback_reminder(
                    interviewer_name=interviewer.name,
                    interviewer_email=interviewer.email,
                    candidate_name=(candidate.name if candidate else "Candidate") or "Candidate",
                    round_label=round_label,
                )
                log.info("Feedback reminder sent to %s for round %s", interviewer.email, round_.id)

    run_async(_run())
