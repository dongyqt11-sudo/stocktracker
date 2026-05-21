from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Application settings loaded from backend/.env."""

    qwen_api_key: str = Field(default="", alias="QWEN_API_KEY")
    qwen_model: str = Field(default="qwen3-vl-plus", alias="QWEN_MODEL")
    qwen_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        alias="QWEN_BASE_URL",
    )
    ai_timeout_seconds: int = Field(default=30, alias="AI_TIMEOUT_SECONDS")
    database_url: str = Field(default="sqlite:///./data/stocktracker.db", alias="DATABASE_URL")
    screenshot_dir: str = Field(default="./data/screenshots", alias="SCREENSHOT_DIR")
    frontend_origin: str = Field(default="http://127.0.0.1:5173", alias="FRONTEND_ORIGIN")

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def screenshot_path(self) -> Path:
        return Path(self.screenshot_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
