from collections import defaultdict
from datetime import datetime, time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.holdings import Holding
from app.models.transactions import Transaction

router = APIRouter(prefix="/dashboard", tags=["consistency"])


def _float(value: Decimal | int | float | None) -> float:
    if value is None:
        return 0.0
    return round(float(value), 2)


def _holdings_by_date(db: Session, account_id: str, snapshot_date) -> dict[str, Holding]:
    return {
        row.stock_code: row
        for row in db.scalars(
            select(Holding).where(
                Holding.account_id == account_id,
                Holding.snapshot_date == snapshot_date,
            )
        )
    }


@router.get("/consistency")
def consistency_check(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    snapshot_dates = list(
        db.scalars(
            select(Holding.snapshot_date)
            .where(Holding.account_id == account_id)
            .group_by(Holding.snapshot_date)
            .order_by(Holding.snapshot_date.asc())
        )
    )
    if len(snapshot_dates) < 2:
        return {
            "account_id": account_id,
            "issue_count": 0,
            "issues": [],
            "message": "至少需要两次持仓快照才会进行一致性校验",
        }

    issues: list[dict[str, Any]] = []

    for previous_date, current_date in zip(snapshot_dates, snapshot_dates[1:]):
        previous_holdings = _holdings_by_date(db, account_id, previous_date)
        current_holdings = _holdings_by_date(db, account_id, current_date)
        window_start = datetime.combine(previous_date, time.max)
        window_end = datetime.combine(current_date, time.max)

        direction_rows = db.execute(
            select(
                Transaction.stock_code,
                Transaction.direction,
                func.sum(Transaction.quantity).label("total_qty"),
            )
            .where(
                Transaction.account_id == account_id,
                Transaction.quantity.isnot(None),
                Transaction.trade_time > window_start,
                Transaction.trade_time <= window_end,
            )
            .group_by(Transaction.stock_code, Transaction.direction)
        ).all()

        txn_net: dict[str, float] = defaultdict(float)
        for stock_code, direction, total_qty in direction_rows:
            qty = _float(total_qty)
            if direction == "buy":
                txn_net[stock_code] += qty
            elif direction == "sell":
                txn_net[stock_code] -= qty

        all_codes = set(previous_holdings.keys()) | set(current_holdings.keys()) | set(txn_net.keys())
        for code in sorted(all_codes):
            previous_qty = _float(previous_holdings[code].quantity) if code in previous_holdings else 0.0
            actual_qty = _float(current_holdings[code].quantity) if code in current_holdings else 0.0
            net_qty = txn_net.get(code, 0.0)
            expected_qty = round(previous_qty + net_qty, 2)
            diff = round(expected_qty - actual_qty, 2)
            if abs(diff) < 1:
                continue

            stock_name = (
                current_holdings[code].stock_name
                if code in current_holdings
                else previous_holdings[code].stock_name
                if code in previous_holdings
                else None
            )
            if code not in current_holdings and abs(expected_qty) >= 1:
                issue_type = "missing_holding"
            elif abs(net_qty) < 1:
                issue_type = "missing_transaction"
            else:
                issue_type = "quantity_mismatch"

            issues.append(
                {
                    "stock_code": code,
                    "stock_name": stock_name,
                    "type": issue_type,
                    "message": (
                        f"{previous_date.isoformat()} 到 {current_date.isoformat()}："
                        f"上一快照 {previous_qty:.0f} 股，期间成交净变动 {net_qty:+.0f} 股，"
                        f"预期 {expected_qty:.0f} 股，实际 {actual_qty:.0f} 股。"
                    ),
                    "expected_quantity": expected_qty,
                    "actual_quantity": actual_qty,
                    "difference": diff,
                    "window_start": previous_date.isoformat(),
                    "window_end": current_date.isoformat(),
                }
            )

    return {
        "account_id": account_id,
        "issue_count": len(issues),
        "issues": issues,
    }
