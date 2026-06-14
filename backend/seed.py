"""
Run to seed initial users + interviewer profile (safe to run multiple times):
  docker compose exec api python seed.py
"""
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.interviewer import Interviewer
from app.models.user import User, UserRole

USERS = [
    {"name": "Super Admin",      "email": "admin@company.com",       "password": "Admin@1234",       "role": UserRole.admin},
    {"name": "Sarah Recruiter",  "email": "recruiter@company.com",   "password": "Recruiter@1234",   "role": UserRole.recruiter},
    {"name": "Alex Interviewer", "email": "interviewer@company.com", "password": "Interviewer@1234", "role": UserRole.interviewer},
]

INTERVIEWER_PROFILE = {
    "name": "Alex Interviewer",
    "email": "interviewer@company.com",
    "department": "Engineering",
    "skills": ["Python", "System Design", "Data Structures", "FastAPI"],
    "eligible_rounds": [1, 2, 3],
    "max_interviews_per_week": 5,
}


async def seed():
    async with AsyncSessionLocal() as db:
        created_users = 0
        for u in USERS:
            existing = await db.scalar(select(User).where(User.email == u["email"]))
            if existing:
                print(f"   ⏭  skipping user {u['email']} (already exists)")
                continue
            db.add(User(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                is_active=True,
            ))
            created_users += 1

        # Ensure the seeded interviewer user has a matching Interviewer profile
        # so GET /rounds returns data when logged in as interviewer@company.com
        existing_iv = await db.scalar(
            select(Interviewer).where(Interviewer.email == INTERVIEWER_PROFILE["email"])
        )
        if existing_iv:
            print(f"   ⏭  skipping interviewer profile {INTERVIEWER_PROFILE['email']} (already exists)")
        else:
            db.add(Interviewer(**INTERVIEWER_PROFILE))
            print(f"   ✅ Created interviewer profile for {INTERVIEWER_PROFILE['email']}")

        await db.commit()

    if created_users:
        print(f"\n✅ Created {created_users} user(s).")
    print("\nDemo credentials:")
    for u in USERS:
        print(f"   {u['role'].value:12} | {u['email']:35} | {u['password']}")


asyncio.run(seed())
