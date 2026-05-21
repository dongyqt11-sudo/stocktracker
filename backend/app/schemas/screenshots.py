from typing import Any

from pydantic import BaseModel, ConfigDict


class ScreenshotUploadResponse(BaseModel):
    screenshot_id: int
    account_id: str
    account_name: str
    status: str
    recognized_data: dict[str, Any]
    error: str | None = None


class ScreenshotConfirmRequest(BaseModel):
    screenshot_type: str
    data: dict[str, Any]

    model_config = ConfigDict(extra="forbid")


class ScreenshotConfirmResponse(BaseModel):
    screenshot_id: int
    account_id: str
    account_name: str
    status: str
    inserted_count: int
