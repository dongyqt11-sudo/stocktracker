from collections import defaultdict
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.holdings import Holding
from app.models.transactions import Transaction

router = APIRouter(prefix="/dashboard", tags=["consistency"])


def _float(value: Decimal | int | float | None) -> float:
    if value is None:
        return 0.0
    return round(float(value), 2)


@router.get("/consistency")
def consistency_check(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    latest_date = db.scalar(
        select(Holding.snapshot_date)
        .where(Holding.account_id == account_id)
        .order_by(desc(Holding.snapshot_date))
        .limit(1)
    )

    latest_holdings: dict[str, Holding] = {}
    if latest_date is not None:
        for row in db.scalars(
            select(Holding)
            .where(Holding.account_id == account_id, Holding.snapshot_date == latest_date)
        ):
            latest_holdings[row.stock_code] = row

    direction_rows = db.execute(
        select(
            Transaction.stock_code,
            Transaction.direction,
            func.sum(Transaction.quantity).label("total_qty"),
        )
        .where(
            Transaction.account_id == account_id,
            Transaction.quantity.isnot(None),
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

    issues: list[dict[str, Any]] = []

    all_codes = set(latest_holdings.keys()) | set(txn_net.keys())
    for code in sorted(all_codes):
        holding_qty = _float(latest_holdings[code].quantity) if code in latest_holdings else 0.0
        txn_qty = txn_net.get(code, 0.0)

        in_holdings = code in latest_holdings
        in_transactions = code in txn_net

        if not in_holdings and in_transactions:
            issues.append({
                "stock_code": code,
                "stock_name": None,
                "type": "missing_holding",
                "message": f"成交中有 {code} 的交易记录，但最新持仓中没有该股票",
                "expected_quantity": txn_qty,
                "actual_quantity": 0.0,
                "difference": txn_qty,
            })
            continue

        if in_holdings and not in_transactions:
            issues.append({
                "stock_code": code,
                "stock_name": latest_holdings[code].stock_name,
                "type": "missing_transaction",
                "message": f"持仓中有 {code} {latest_holdings[code].stock_name or ''}，但没有任何成交记录",
                "expected_quantity": 0.0,
                "actual_quantity": holding_qty,
                "difference": -holding_qty,
            })
            continue

        diff = round(txn_qty - holding_qty, 2)
        if abs(diff) >= 1:
            stock_name = latest_holdings[code].stock_name if code in latest_holdings else None
            issues.append({
                "stock_code": code,
                "stock_name": stock_name,
                "type": "quantity_mismatch",
                "message": (
                    f"{code} {stock_name or ''}：成交净买入 {txn_qty:.0f} 股，"
                    f"但持仓显示 {holding_qty:.0f} 股，差额 {diff:+.0f} 股"
                ),
                "expected_quantity": txn_qty,
                "actual_quantity": holding_qty,
                "difference": diff,
            })

    return {
        "account_id": account_id,
        "issue_count": len(issues),
        "issues": issues,
    }
