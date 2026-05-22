from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


class AssetsRecognizedData(BaseModel):
    screenshot_type: Literal["assets"]
    snapshot_date: date
    total_assets: float | None = None
    market_value: float | None = None
    cash_available: float | None = None
    daily_profit_loss: float | None = None
    total_profit_loss: float | None = None

    model_config = ConfigDict(extra="allow")


class AssetsDailyOut(BaseModel):
    id: int
    account_id: str
    account_name: str
    snapshot_date: date
    total_assets: float | None
    market_value: float | None
    cash_available: float | None
    daily_profit_loss: float | None
    total_profit_loss: float | None
    screenshot_id: int

    model_config = ConfigDict(from_attributes=True)
