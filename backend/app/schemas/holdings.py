from datetime import date

from pydantic import BaseModel, ConfigDict


class HoldingItem(BaseModel):
    stock_code: str
    stock_name: str | None = None
    quantity: float | None = None
    cost_price: float | None = None
    current_price: float | None = None
    market_value: float | None = None
    profit_loss: float | None = None
    profit_loss_pct: float | None = None

    model_config = ConfigDict(extra="allow")


class HoldingRecognizedData(BaseModel):
    screenshot_type: str
    snapshot_date: date
    items: list[HoldingItem]

    model_config = ConfigDict(extra="allow")


class HoldingOut(BaseModel):
    id: int
    account_id: str
    account_name: str
    snapshot_date: date
    stock_code: str
    stock_name: str | None
    quantity: float | None
    cost_price: float | None
    current_price: float | None
    market_value: float | None
    profit_loss: float | None
    profit_loss_pct: float | None
    screenshot_id: int

    model_config = ConfigDict(from_attributes=True)
