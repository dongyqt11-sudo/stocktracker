from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.assets import AssetsDaily
from app.schemas.assets import AssetsDailyOut

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/timeline", response_model=list[AssetsDailyOut])
def assets_timeline(
    days: int = Query(default=30, ge=1, le=3650),
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> list[AssetsDaily]:
    since = date.today() - timedelta(days=days - 1)
    return list(
        db.scalars(
            select(AssetsDaily)
            .where(AssetsDaily.account_id == account_id, AssetsDaily.snapshot_date >= since)
            .order_by(AssetsDaily.snapshot_date.asc())
        )
    )


@router.get("/latest", response_model=AssetsDailyOut | None)
def latest_assets(
    account_id: str = Query(default="account_1"),
    db: Session = Depends(get_db),
) -> AssetsDaily | None:
    return db.scalar(
        select(AssetsDaily)
        .where(AssetsDaily.account_id == account_id)
        .order_by(desc(AssetsDaily.snapshot_date), desc(AssetsDaily.id))
        .limit(1)
    )
