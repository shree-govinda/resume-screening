"""
SendGrid email service. All methods are no-ops when SENDGRID_API_KEY is not set,
so the app works in dev without email credentials.
"""
import logging
from datetime import datetime

log = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        from app.core.config import settings
        self._api_key = settings.SENDGRID_API_KEY
        self._from_email = settings.SENDGRID_FROM_EMAIL

    def _client(self):
        if not self._api_key:
            return None
        from sendgrid import SendGridAPIClient
        return SendGridAPIClient(self._api_key)

    def _send(self, to: str, subject: str, body_html: str) -> bool:
        client = self._client()
        if not client:
            log.warning("SendGrid not configured — skipping email to %s: %s", to, subject)
            return False
        try:
            from sendgrid.helpers.mail import Mail
            msg = Mail(
                from_email=self._from_email,
                to_emails=to,
                subject=subject,
                html_content=body_html,
            )
            response = client.send(msg)
            log.info("Email sent to %s — status %s", to, response.status_code)
            return True
        except Exception as exc:
            log.error("SendGrid error: %s", exc)
            return False

    def send_shortlist_notification(self, candidate_name: str, candidate_email: str, job_title: str) -> bool:
        subject = f"Application Update: {job_title}"
        body = f"""
        <p>Dear {candidate_name},</p>
        <p>Congratulations! After reviewing your application for <strong>{job_title}</strong>,
        we are pleased to inform you that you have been shortlisted for the interview process.</p>
        <p>You will receive a separate email with your interview schedule shortly.</p>
        <p>Best regards,<br>Talent Acquisition Team</p>
        """
        return self._send(candidate_email, subject, body)

    def send_rejection_notification(self, candidate_name: str, candidate_email: str, job_title: str) -> bool:
        subject = f"Your Application for {job_title}"
        body = f"""
        <p>Dear {candidate_name},</p>
        <p>Thank you for your interest in the <strong>{job_title}</strong> position.
        After careful consideration, we have decided to move forward with other candidates
        whose qualifications more closely match our current needs.</p>
        <p>We encourage you to apply for future openings.</p>
        <p>Best regards,<br>Talent Acquisition Team</p>
        """
        return self._send(candidate_email, subject, body)

    def send_interview_invite(
        self,
        candidate_name: str,
        candidate_email: str,
        job_title: str,
        round_number: int,
        round_label: str,
        scheduled_at: datetime,
        duration_mins: int,
        teams_url: str | None,
    ) -> bool:
        subject = f"Interview Invitation — {job_title} ({round_label})"
        teams_section = f'<p><strong>Teams Link:</strong> <a href="{teams_url}">{teams_url}</a></p>' if teams_url else ""
        body = f"""
        <p>Dear {candidate_name},</p>
        <p>We are pleased to invite you for <strong>Round {round_number}: {round_label}</strong>
        for the <strong>{job_title}</strong> position.</p>
        <p><strong>Date & Time:</strong> {scheduled_at.strftime("%A, %B %d %Y at %I:%M %p %Z")}</p>
        <p><strong>Duration:</strong> {duration_mins} minutes</p>
        {teams_section}
        <p>Please ensure you are available and prepared. Reply to this email if you need to reschedule.</p>
        <p>Best regards,<br>Talent Acquisition Team</p>
        """
        return self._send(candidate_email, subject, body)

    def send_interviewer_assignment(
        self,
        interviewer_name: str,
        interviewer_email: str,
        candidate_name: str,
        job_title: str,
        round_number: int,
        round_label: str,
        scheduled_at: datetime,
        duration_mins: int,
        teams_url: str | None,
    ) -> bool:
        subject = f"Interview Assignment — {candidate_name} ({round_label})"
        teams_section = f'<p><strong>Teams Link:</strong> <a href="{teams_url}">{teams_url}</a></p>' if teams_url else ""
        body = f"""
        <p>Dear {interviewer_name},</p>
        <p>You have been assigned to interview <strong>{candidate_name}</strong>
        for the <strong>{job_title}</strong> position.</p>
        <p><strong>Round:</strong> Round {round_number} — {round_label}</p>
        <p><strong>Date & Time:</strong> {scheduled_at.strftime("%A, %B %d %Y at %I:%M %p %Z")}</p>
        <p><strong>Duration:</strong> {duration_mins} minutes</p>
        {teams_section}
        <p>Please submit your feedback within 24 hours of the interview.</p>
        <p>Best regards,<br>Talent Acquisition Team</p>
        """
        return self._send(interviewer_email, subject, body)

    def send_feedback_reminder(
        self,
        interviewer_name: str,
        interviewer_email: str,
        candidate_name: str,
        round_label: str,
    ) -> bool:
        subject = f"Reminder: Submit Interview Feedback — {candidate_name}"
        body = f"""
        <p>Dear {interviewer_name},</p>
        <p>This is a reminder to submit your feedback for <strong>{candidate_name}</strong>
        ({round_label}) which took place more than 24 hours ago.</p>
        <p>Please log in and submit your evaluation as soon as possible to keep the process moving.</p>
        <p>Best regards,<br>Talent Acquisition Team</p>
        """
        return self._send(interviewer_email, subject, body)


email_service = EmailService()
