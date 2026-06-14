from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "resume_screening",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "feedback-reminder-hourly": {
            "task": "app.workers.tasks.feedback_reminder_task",
            "schedule": crontab(minute=0),  # every hour
        },
    },
)
