from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AssetsDaily(Base):
    __tablename__ = "assets_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, unique=True, index=True, nullable=False)
    total_assets: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    market_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    cash_available: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    daily_profit_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    total_profit_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    screenshot_id: Mapped[int] = mapped_column(ForeignKey("screenshots.id"), nullable=False)

    screenshot = relationship("Screenshot", back_populates="assets_daily")
