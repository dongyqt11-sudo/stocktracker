from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[str] = mapped_column(String, default="account_1", index=True, nullable=False)
    account_name: Mapped[str] = mapped_column(String, default="Account 1", nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    stock_code: Mapped[str] = mapped_column(String, index=True, nullable=False)
    stock_name: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    current_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    market_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    profit_loss: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    profit_loss_pct: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    screenshot_id: Mapped[int] = mapped_column(ForeignKey("screenshots.id"), nullable=False)

    screenshot = relationship("Screenshot", back_populates="holdings")
