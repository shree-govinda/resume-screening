from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


class AuditService:
    @staticmethod
    async def log(
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID,
        action: str,
        performed_by: UUID | None,
        payload: dict,
    ) -> None:
        entry = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by=performed_by,
            payload=payload,
        )
        db.add(entry)
        await db.flush()
