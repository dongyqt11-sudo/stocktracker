from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.assets import AssetsDaily
from app.models.holdings import Holding
from app.models.screenshots import Screenshot
from app.models.transactions import Transaction

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _float(value: Decimal | int | float | None) -> float:
    if value is None:
        return 0.0
    return round(float(value), 2)


def _nullable_float(value: Decimal | int | float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _holding_dict(row: Holding) -> dict[str, Any]:
    return {
        "id": row.id,
        "account_id": row.account_id,
        "account_name": row.account_name,
        "snapshot_date": row.snapshot_date.isoformat(),
        "stock_code": row.stock_code,
        "stock_name": row.stock_name,
        "quantity": _nullable_float(row.quantity),
        "cost_price": _nullable_float(row.cost_price),
        "current_price": _nullable_float(row.current_price),
        "market_value": _nullable_float(row.market_value),
        "profit_loss": _nullable_float(row.profit_loss),
        "profit_loss_pct": _nullable_float(row.profit_loss_pct),
        "screenshot_id": row.screenshot_id,
    }


def _transaction_dict(row: Transaction) -> dict[str, Any]:
    return {
        "id": row.id,
        "account_id": row.account_id,
        "account_name": row.account_name,
        "trade_time": row.trade_time.isoformat(sep=" "),
        "stock_code": row.stock_code,
        "stock_name": row.stock_name,
        "direction": row.direction,
        "price": _nullable_float(row.price),
        "quantity": _nullable_float(row.quantity),
        "amount": _nullable_float(row.amount),
        "fee": _nullable_float(row.fee),
        "screenshot_id": row.screenshot_id,
    }


def _asset_dict(row: AssetsDaily) -> dict[str, Any]:
    return {
        "id": row.id,
        "account_id": row.account_id,
        "account_name": row.account_name,
        "snapshot_date": row.snapshot_date.isoformat(),
        "total_assets": _nullable_float(row.total_assets),
        "market_value": _nullable_float(row.market_value),
        "cash_available": _nullable_float(row.cash_available),
        "daily_profit_loss": _nullable_float(row.daily_profit_loss),
        "total_profit_loss": _nullable_float(row.total_profit_loss),
        "screenshot_id": row.screenshot_id,
    }


def _upload_streak(upload_dates: set[date]) -> int:
    today = date.today()
    streak = 0
    cursor = today
    while cursor in upload_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/summary")
def summary(
    account_id: str = Query(default="account_1"),
    days: int = Query(default=30, ge=1, le=3650),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    latest_assets = db.scalar(
        select(AssetsDaily)
        .where(AssetsDaily.account_id == account_id)
        .order_by(desc(AssetsDaily.snapshot_date), desc(AssetsDaily.id))
        .limit(1)
    )
    previous_assets = None
    if latest_assets is not None:
        previous_assets = db.scalar(
            select(AssetsDaily)
            .where(
                AssetsDaily.account_id == account_id,
                AssetsDaily.snapshot_date < latest_assets.snapshot_date,
            )
            .order_by(desc(AssetsDaily.snapshot_date), desc(AssetsDaily.id))
            .limit(1)
        )

    latest_date = db.scalar(
        select(Holding.snapshot_date)
        .where(Holding.account_id == account_id)
        .order_by(desc(Holding.snapshot_date))
        .limit(1)
    )
    holdings: list[Holding] = []
    if latest_date is not None:
        holdings = list(
            db.scalars(
                select(Holding)
                .where(Holding.account_id == account_id, Holding.snapshot_date == latest_date)
                .order_by(desc(Holding.market_value), Holding.stock_code)
            )
        )

    holding_market_value = sum(_float(row.market_value) for row in holdings)
    holding_profit_loss = sum(_float(row.profit_loss) for row in holdings)
    total_assets = _float(latest_assets.total_assets) if latest_assets else holding_market_value
    market_value = _float(latest_assets.market_value) if latest_assets else holding_market_value
    cash_available = _float(latest_assets.cash_available) if latest_assets else 0.0
    daily_profit_loss = _float(latest_assets.daily_profit_loss) if latest_assets else holding_profit_loss

    since = date.today() - timedelta(days=days - 1)
    asset_curve = [
        _asset_dict(row)
        for row in db.scalars(
            select(AssetsDaily)
            .where(AssetsDaily.account_id == account_id, AssetsDaily.snapshot_date >= since)
            .order_by(AssetsDaily.snapshot_date.asc())
        )
    ]

    status_counts = dict(
        db.execute(
            select(Screenshot.status, func.count(Screenshot.id))
            .where(Screenshot.account_id == account_id)
            .group_by(Screenshot.status)
        ).all()
    )
    upload_dates = {
        uploaded_at.date()
        for uploaded_at in db.scalars(select(Screenshot.uploaded_at).where(Screenshot.account_id == account_id))
        if isinstance(uploaded_at, datetime)
    }
    today = date.today()
    recent_transactions = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.account_id == account_id)
            .order_by(desc(Transaction.trade_time), desc(Transaction.id))
            .limit(5)
        )
    )

    return {
        "account_id": account_id,
        "summary": {
            "total_assets": total_assets,
            "market_value": market_value,
            "cash_available": cash_available,
            "daily_profit_loss": daily_profit_loss,
            "holdings_count": len(holdings),
            "snapshot_date": latest_assets.snapshot_date.isoformat() if latest_assets else (latest_date.isoformat() if latest_date else None),
            "change_vs_previous": {
                "total_assets": round(total_assets - _float(previous_assets.total_assets), 2) if previous_assets else None,
                "market_value": round(market_value - _float(previous_assets.market_value), 2) if previous_assets else None,
                "cash_available": round(cash_available - _float(previous_assets.cash_available), 2) if previous_assets else None,
                "daily_profit_loss": round(daily_profit_loss - _float(previous_assets.daily_profit_loss), 2) if previous_assets else None,
            },
        },
        "holdings": [_holding_dict(row) for row in holdings],
        "assets_latest": _asset_dict(latest_assets) if latest_assets else None,
        "asset_curve": asset_curve,
        "recognition": {
            "pending": int(status_counts.get("pending", 0)),
            "confirmed": int(status_counts.get("confirmed", 0)),
            "rejected": int(status_counts.get("rejected", 0)),
            "today_uploads": sum(1 for uploaded_date in upload_dates if uploaded_date == today),
            "upload_streak_days": _upload_streak(upload_dates),
        },
        "recent_transactions": [_transaction_dict(row) for row in recent_transactions],
    }
