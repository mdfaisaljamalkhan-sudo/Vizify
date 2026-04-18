from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./subadash.db"
    jwt_secret: str = "your-secret-key-change-this"
    jwt_algorithm: str = "HS256"

    # LLM Provider Settings
    analyzer_provider: str = "claude"  # Options: claude, openai, deepseek, ollama, groq, gemini
    anthropic_api_key: str = ""
    anthropic_model_analyze: str = "claude-haiku-4-5-20251001"
    anthropic_model_chat: str = "claude-haiku-4-5-20251001"
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434/v1"
    groq_api_key: str = ""
    gemini_api_key: str = ""
    # Comma-separated fallback chain, e.g. "claude,groq,gemini"
    llm_fallback_chain: str = "claude,groq,gemini"
    max_analysis_input_tokens: int = 8000

    # Stripe Settings
    stripe_secret_key: str = ""

    # App Settings
    # Comma-separated origins via FRONTEND_ORIGIN env var; legacy list kept as dev fallback.
    frontend_origin: str = "http://localhost:5173,http://localhost:3000"
    environment: str = "development"
    max_upload_mb: int = 25

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

settings = Settings()

# SQLAlchemy
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    future=True
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
