from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.holdings import Holding
from app.models.screenshots import Screenshot
from app.models.transactions import Transaction

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _float(value: Decimal | int | float | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def _holding_dict(row: Holding) -> dict[str, Any]:
    return {
        "id": row.id,
        "account_id": row.account_id,
        "account_name": row.account_name,
        "snapshot_date": row.snapshot_date.isoformat(),
        "stock_code": row.stock_code,
        "stock_name": row.stock_name,
        "quantity": _float(row.quantity),
        "cost_price": _float(row.cost_price),
        "current_price": _float(row.current_price),
        "market_value": _float(row.market_value),
        "profit_loss": _float(row.profit_loss),
        "profit_loss_pct": _float(row.profit_loss_pct),
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


@router.get("/dashboard")
def dashboard_summary(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    latest_date = db.scalar(
        select(Holding.snapshot_date)
        .where(Holding.account_id == account_id)
        .order_by(desc(Holding.snapshot_date))
        .limit(1)
    )
    latest_holdings: list[Holding] = []
    if latest_date is not None:
        latest_holdings = list(
            db.scalars(
                select(Holding)
                .where(Holding.account_id == account_id, Holding.snapshot_date == latest_date)
                .order_by(desc(Holding.market_value), Holding.stock_code)
            )
        )

    total_market_value = sum(_float(row.market_value) for row in latest_holdings)
    total_profit_loss = sum(_float(row.profit_loss) for row in latest_holdings)

    curve_map: dict[date, float] = defaultdict(float)
    for snapshot_date, market_value in db.execute(
        select(Holding.snapshot_date, Holding.market_value).where(Holding.account_id == account_id)
    ):
        curve_map[snapshot_date] += _float(market_value)
    asset_curve = [
        {"date": snapshot_date.isoformat(), "total_assets": value}
        for snapshot_date, value in sorted(curve_map.items())
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

    return {
        "account_id": account_id,
        "summary": {
            "total_assets": total_market_value,
            "market_value": total_market_value,
            "cash_available": 0,
            "daily_profit_loss": total_profit_loss,
            "holdings_count": len(latest_holdings),
            "snapshot_date": latest_date.isoformat() if latest_date else None,
        },
        "holdings": [_holding_dict(row) for row in latest_holdings],
        "asset_curve": asset_curve,
        "recognition": {
            "pending": int(status_counts.get("pending", 0)),
            "confirmed": int(status_counts.get("confirmed", 0)),
            "rejected": int(status_counts.get("rejected", 0)),
            "today_uploads": sum(1 for uploaded_date in upload_dates if uploaded_date == today),
            "upload_streak_days": _upload_streak(upload_dates),
        },
        "recent_transactions": [],
    }


@router.get("/overview")
def analytics_overview(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    latest_date = db.scalar(
        select(Holding.snapshot_date)
        .where(Holding.account_id == account_id)
        .order_by(desc(Holding.snapshot_date))
        .limit(1)
    )

    # Top profit/loss holdings
    profit_ranking: list[dict[str, Any]] = []
    if latest_date is not None:
        rows = list(
            db.scalars(
                select(Holding)
                .where(Holding.account_id == account_id, Holding.snapshot_date == latest_date)
                .order_by(desc(Holding.profit_loss))
                .limit(5)
            )
        )
        profit_ranking = [_holding_dict(row) for row in rows]

    # Position concentration (top 5 by market value + others)
    concentration: list[dict[str, Any]] = []
    if latest_date is not None:
        all_holdings = list(
            db.scalars(
                select(Holding)
                .where(Holding.account_id == account_id, Holding.snapshot_date == latest_date)
                .order_by(desc(Holding.market_value))
            )
        )
        top5 = all_holdings[:5]
        others_value = sum(_float(row.market_value) for row in all_holdings[5:])
        for row in top5:
            concentration.append({
                "stock_code": row.stock_code,
                "stock_name": row.stock_name,
                "market_value": _float(row.market_value),
                "pct": round(_float(row.market_value) / (sum(_float(h.market_value) for h in all_holdings) or 1) * 100, 1),
            })
        if others_value > 0:
            total_mv = sum(_float(row.market_value) for row in all_holdings)
            concentration.append({
                "stock_code": "",
                "stock_name": "其他",
                "market_value": others_value,
                "pct": round(others_value / (total_mv or 1) * 100, 1),
            })

    # Monthly transaction stats
    today = date.today()
    month_start = today.replace(day=1)
    month_txns = list(
        db.scalars(
            select(Transaction)
            .where(
                Transaction.account_id == account_id,
                Transaction.trade_time >= datetime.combine(month_start, datetime.min.time()),
            )
        )
    )
    buy_txns = [t for t in month_txns if t.direction == "buy"]
    sell_txns = [t for t in month_txns if t.direction == "sell"]
    buy_amount = sum(_float(t.amount) for t in buy_txns)
    sell_amount = sum(_float(t.amount) for t in sell_txns)

    return {
        "account_id": account_id,
        "profit_ranking": profit_ranking,
        "concentration": concentration,
        "monthly_stats": {
            "month": month_start.isoformat(),
            "trade_count": len(month_txns),
            "buy_count": len(buy_txns),
            "sell_count": len(sell_txns),
            "buy_amount": buy_amount,
            "sell_amount": sell_amount,
        },
    }
