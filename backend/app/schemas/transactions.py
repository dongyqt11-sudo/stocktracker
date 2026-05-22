from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class TransactionItem(BaseModel):
    trade_time: datetime
    stock_code: str
    stock_name: str | None = None
    direction: Literal["buy", "sell"]
    price: float | None = None
    quantity: float | None = None
    amount: float | None = None
    fee: float | None = None

    model_config = ConfigDict(extra="allow")


class TransactionRecognizedData(BaseModel):
    screenshot_type: Literal["transactions"]
    items: list[TransactionItem]

    model_config = ConfigDict(extra="allow")


class TransactionOut(BaseModel):
    id: int
    account_id: str
    account_name: str
    trade_time: datetime
    stock_code: str
    stock_name: str | None
    direction: str
    price: float | None
    quantity: float | None
    amount: float | None
    fee: float | None
    screenshot_id: int

    model_config = ConfigDict(from_attributes=True)
