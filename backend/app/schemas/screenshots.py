from typing import Any

from pydantic import BaseModel, ConfigDict


class ScreenshotListItem(BaseModel):
    id: int
    account_id: str
    account_name: str
    uploaded_at: str
    screenshot_type: str | None
    status: str
    file_name: str
    image_url: str
    item_count: int | None = None
    snapshot_date: str | None = None
    linked_count: int
    error: str | None = None


class ScreenshotListResponse(BaseModel):
    account_id: str
    items: list[ScreenshotListItem]


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
