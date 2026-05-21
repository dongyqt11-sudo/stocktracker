from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.holdings import Holding
from app.schemas.holdings import HoldingOut

router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.get("/latest", response_model=list[HoldingOut])
def latest_holdings(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> list[Holding]:
    latest_date = db.scalar(
        select(Holding.snapshot_date)
        .where(Holding.account_id == account_id)
        .order_by(desc(Holding.snapshot_date))
        .limit(1)
    )
    if latest_date is None:
        return []

    return list(
        db.scalars(
            select(Holding)
            .where(Holding.account_id == account_id, Holding.snapshot_date == latest_date)
            .order_by(desc(Holding.market_value), Holding.stock_code)
        )
    )


@router.get("/history", response_model=list[HoldingOut])
def holding_history(
    code: str = Query(..., min_length=1),
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> list[Holding]:
    rows = list(
        db.scalars(
            select(Holding)
            .where(Holding.account_id == account_id, Holding.stock_code == code)
            .order_by(Holding.snapshot_date.asc(), Holding.id.asc())
        )
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No holding history found for this stock.")
    return rows
