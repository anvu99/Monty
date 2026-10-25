from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200

    # AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3-flash-preview"
    AI_TIMEOUT_SECONDS: float = Field(default=15.0, gt=0, le=120)
    AI_MAX_INPUT_TOKENS: int = Field(default=10000, ge=500, le=10000)
    AI_MAX_OUTPUT_TOKENS: int = Field(default=1200, ge=128, le=4000)
    AI_PROMPT_VERSION: str = "typed-memory-v4"
    AI_MEMORY_EXTRACTION_MAX_OUTPUT_TOKENS: int = Field(default=2400, ge=128, le=4000)
    AI_EXTRACTION_WORKER_ENABLED: bool = True
    AI_SEMANTIC_CONSOLIDATION_ENABLED: bool = False
    DEMO_PURCHASES_ENABLED: bool = False

    # App
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Single shared instance — import this everywhere
settings = get_settings()
