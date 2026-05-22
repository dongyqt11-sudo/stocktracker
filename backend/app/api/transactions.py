from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.transactions import Transaction
from app.schemas.transactions import TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _day_start(value: date | None) -> datetime | None:
    return datetime.combine(value, time.min) if value else None


def _day_end(value: date | None) -> datetime | None:
    return datetime.combine(value, time.max) if value else None


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    code: str | None = Query(default=None),
    direction: str | None = Query(default=None, pattern="^(buy|sell)$"),
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> list[Transaction]:
    query = select(Transaction).where(Transaction.account_id == account_id)
    if start:
        query = query.where(Transaction.trade_time >= _day_start(start))
    if end:
        query = query.where(Transaction.trade_time <= _day_end(end))
    if code:
        query = query.where(Transaction.stock_code.contains(code.strip()))
    if direction:
        query = query.where(Transaction.direction == direction)
    return list(db.scalars(query.order_by(desc(Transaction.trade_time), desc(Transaction.id))))
