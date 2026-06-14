"""
Microsoft Graph API service for creating Teams meetings and calendar events.
Falls back to placeholder URL when MS credentials are not configured.
"""
import logging
from datetime import datetime, timedelta, timezone

import httpx

log = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
ROUND_LABELS = {1: "Technical Screen", 2: "Technical Deep-Dive", 3: "Final Managerial"}


class GraphService:
    def __init__(self):
        from app.core.config import settings
        self._tenant_id = settings.MS_TENANT_ID
        self._client_id = settings.MS_CLIENT_ID
        self._client_secret = settings.MS_CLIENT_SECRET

    def _configured(self) -> bool:
        return bool(self._tenant_id and self._client_id and self._client_secret)

    async def _get_token(self) -> str | None:
        url = f"https://login.microsoftonline.com/{self._tenant_id}/oauth2/v2.0/token"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "scope": "https://graph.microsoft.com/.default",
            })
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def create_teams_meeting(
        self,
        organizer_email: str,
        attendee_emails: list[str],
        subject: str,
        start_dt: datetime,
        duration_mins: int,
    ) -> str | None:
        """
        Creates a Teams meeting via MS Graph Online Meeting API.
        Returns the join URL, or None if not configured / on error.
        """
        if not self._configured():
            log.warning("MS Graph not configured — skipping Teams meeting creation")
            return None

        try:
            token = await self._get_token()
            end_dt = start_dt + timedelta(minutes=duration_mins)
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

            payload = {
                "subject": subject,
                "startDateTime": start_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
                "endDateTime": end_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
                "participants": {
                    "organizer": {"upn": organizer_email},
                    "attendees": [{"upn": email} for email in attendee_emails],
                },
            }

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{GRAPH_BASE}/users/{organizer_email}/onlineMeetings",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                join_url = data.get("joinUrl") or data.get("joinWebUrl")
                log.info("Teams meeting created: %s", join_url)
                return join_url

        except Exception as exc:
            log.error("Graph API error creating Teams meeting: %s", exc)
            return None

    def default_scheduled_time(self, round_number: int) -> datetime:
        """Returns a default scheduled time (next business day + offset per round)."""
        base = datetime.now(timezone.utc).replace(hour=10, minute=0, second=0, microsecond=0)
        # Offset by 1 day per round so rounds don't stack
        days_ahead = round_number
        dt = base + timedelta(days=days_ahead)
        # Skip weekends
        while dt.weekday() >= 5:
            dt += timedelta(days=1)
        return dt

    def round_label(self, round_number: int) -> str:
        return ROUND_LABELS.get(round_number, f"Round {round_number}")


graph_service = GraphService()
