from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.watchlist import WatchlistStock
from app.services.market_data import (
    MarketDataError,
    get_a_share_history,
    get_a_share_spot_quotes,
    get_cached_a_share_spot_quotes,
)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

WatchStatus = Literal["watching", "focus", "archived"]


def _is_stock_code(value: str) -> bool:
    return len(value) == 6 and value.isdigit()


class WatchlistCreate(BaseModel):
    account_id: str = "account_1"
    account_name: str = "Account 1"
    stock_code: str
    stock_name: str | None = None
    sector: str = "未分类"
    status: WatchStatus = "watching"
    note: str = ""
    target_price: Decimal | None = None
    stop_loss_price: Decimal | None = None

    @field_validator("stock_code")
    @classmethod
    def validate_stock_code(cls, value: str) -> str:
        code = value.strip()
        if not _is_stock_code(code):
            raise ValueError("Stock code must be 6 digits.")
        return code

    @field_validator("sector")
    @classmethod
    def validate_sector(cls, value: str) -> str:
        return value.strip() or "未分类"


class WatchlistUpdate(BaseModel):
    stock_name: str | None = None
    sector: str | None = None
    status: WatchStatus | None = None
    note: str | None = None
    target_price: Decimal | None = None
    stop_loss_price: Decimal | None = None
    sort_order: int | None = None


class WatchlistOut(BaseModel):
    id: int
    account_id: str
    account_name: str
    stock_code: str
    stock_name: str | None
    sector: str
    status: str
    note: str
    target_price: float | None
    stop_loss_price: float | None
    sort_order: int
    created_at: datetime
    latest_price: float | None = None
    change_pct: float | None = None
    change_amount: float | None = None
    turnover: float | None = None
    volume: float | None = None
    amplitude: float | None = None
    high: float | None = None
    low: float | None = None
    open: float | None = None
    previous_close: float | None = None
    turnover_rate: float | None = None
    sixty_day_change_pct: float | None = None
    year_to_date_change_pct: float | None = None
    alert: str | None = None

    model_config = ConfigDict(from_attributes=True)


def _float(value: Decimal | int | float | None) -> float | None:
    return float(value) if value is not None else None


def _alert(row: WatchlistStock, latest_price: float | None) -> str | None:
    if latest_price is None:
        return None
    target = _float(row.target_price)
    stop = _float(row.stop_loss_price)
    if target is not None and latest_price >= target:
        return "target_reached"
    if stop is not None and latest_price <= stop:
        return "stop_loss_reached"
    if target is not None and target > 0 and latest_price >= target * 0.98:
        return "near_target"
    if stop is not None and stop > 0 and latest_price <= stop * 1.02:
        return "near_stop_loss"
    return None


def _row_dict(row: WatchlistStock, quote: dict[str, Any] | None = None) -> dict[str, Any]:
    quote = quote or {}
    latest_price = quote.get("latest_price")
    return {
        "id": row.id,
        "account_id": row.account_id,
        "account_name": row.account_name,
        "stock_code": row.stock_code,
        "stock_name": quote.get("stock_name") or row.stock_name,
        "sector": row.sector,
        "status": row.status,
        "note": row.note,
        "target_price": _float(row.target_price),
        "stop_loss_price": _float(row.stop_loss_price),
        "sort_order": row.sort_order,
        "created_at": row.created_at.isoformat(sep=" "),
        "latest_price": latest_price,
        "change_pct": quote.get("change_pct"),
        "change_amount": quote.get("change_amount"),
        "turnover": quote.get("turnover"),
        "volume": quote.get("volume"),
        "amplitude": quote.get("amplitude"),
        "high": quote.get("high"),
        "low": quote.get("low"),
        "open": quote.get("open"),
        "previous_close": quote.get("previous_close"),
        "turnover_rate": quote.get("turnover_rate"),
        "sixty_day_change_pct": quote.get("sixty_day_change_pct"),
        "year_to_date_change_pct": quote.get("year_to_date_change_pct"),
        "alert": _alert(row, latest_price),
    }


@router.get("")
def list_watchlist(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    rows = list(
        db.scalars(
            select(WatchlistStock)
            .where(WatchlistStock.account_id == account_id)
            .order_by(WatchlistStock.sort_order.asc(), WatchlistStock.id.asc())
        )
    )

    quote_error = None
    quotes: dict[str, dict[str, Any]] = {}
    if rows:
        try:
            quotes = get_a_share_spot_quotes([row.stock_code for row in rows])
        except MarketDataError as exc:
            quote_error = str(exc)

    return {
        "items": [_row_dict(row, quotes.get(row.stock_code)) for row in rows],
        "quote_error": quote_error,
    }


@router.post("")
def create_watchlist_stock(payload: WatchlistCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    existing = db.scalar(
        select(WatchlistStock).where(
            WatchlistStock.account_id == payload.account_id,
            WatchlistStock.stock_code == payload.stock_code,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Stock already exists in this watchlist.")

    stock_name = payload.stock_name
    quote = get_cached_a_share_spot_quotes().get(payload.stock_code)
    if quote and quote.get("stock_name"):
        stock_name = str(quote["stock_name"])

    next_order = (
        db.scalar(
            select(func.max(WatchlistStock.sort_order)).where(WatchlistStock.account_id == payload.account_id)
        )
        or 0
    ) + 1
    row = WatchlistStock(
        account_id=payload.account_id,
        account_name=payload.account_name,
        stock_code=payload.stock_code,
        stock_name=stock_name,
        sector=payload.sector,
        status=payload.status,
        note=payload.note,
        target_price=payload.target_price,
        stop_loss_price=payload.stop_loss_price,
        sort_order=next_order,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Stock already exists in this watchlist.") from exc
    db.refresh(row)
    return _row_dict(row)


@router.put("/{stock_id}")
def update_watchlist_stock(
    stock_id: int,
    payload: WatchlistUpdate,
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    row = db.get(WatchlistStock, stock_id)
    if row is None or row.account_id != account_id:
        raise HTTPException(status_code=404, detail="Watchlist stock not found.")

    if "stock_name" in payload.model_fields_set:
        row.stock_name = payload.stock_name
    if payload.sector is not None:
        row.sector = payload.sector.strip() or "未分类"
    if payload.status is not None:
        row.status = payload.status
    if payload.note is not None:
        row.note = payload.note
    if "target_price" in payload.model_fields_set:
        row.target_price = payload.target_price
    if "stop_loss_price" in payload.model_fields_set:
        row.stop_loss_price = payload.stop_loss_price
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order

    db.commit()
    db.refresh(row)
    return _row_dict(row)


@router.delete("/{stock_id}")
def delete_watchlist_stock(
    stock_id: int,
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    row = db.get(WatchlistStock, stock_id)
    if row is None or row.account_id != account_id:
        raise HTTPException(status_code=404, detail="Watchlist stock not found.")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/{stock_code}/history")
def watchlist_history(
    stock_code: str,
    days: int = Query(default=90, ge=1, le=3650),
) -> dict[str, Any]:
    code = stock_code.strip()
    if not _is_stock_code(code):
        raise HTTPException(status_code=422, detail="Stock code must be 6 digits.")
    try:
        return {"stock_code": code, "items": get_a_share_history(code, days)}
    except MarketDataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
