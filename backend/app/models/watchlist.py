from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class WatchlistStock(Base):
    __tablename__ = "watchlist_stocks"
    __table_args__ = (UniqueConstraint("account_id", "stock_code", name="uq_watchlist_account_stock"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[str] = mapped_column(String, default="account_1", index=True, nullable=False)
    account_name: Mapped[str] = mapped_column(String, default="Account 1", nullable=False)
    stock_code: Mapped[str] = mapped_column(String, index=True, nullable=False)
    stock_name: Mapped[str | None] = mapped_column(String, nullable=True)
    sector: Mapped[str] = mapped_column(String, default="未分类", index=True, nullable=False)
    status: Mapped[str] = mapped_column(String, default="watching", index=True, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    target_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    stop_loss_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
