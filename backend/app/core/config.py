from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Resume Screening System"
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI
    AI_API_URL: str = "http://164.52.211.238/api/generate"
    AI_API_KEY: str
    AI_MODEL: str = "gemma3:12b-it-q8_0"
    AI_TIMEOUT: int = 120

    # Storage
    STORAGE_BACKEND: str = "local"
    LOCAL_UPLOAD_DIR: str = "/app/uploads"
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_CONTAINER_NAME: str = "resumes"

    # Microsoft Graph
    MS_TENANT_ID: str = ""
    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""

    # SendGrid
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@company.com"
    SENDGRID_TEMPLATE_SHORTLIST: str = ""
    SENDGRID_TEMPLATE_REJECTION: str = ""
    SENDGRID_TEMPLATE_INTERVIEW_INVITE: str = ""
    SENDGRID_TEMPLATE_IV_ASSIGNMENT: str = ""


settings = Settings()
