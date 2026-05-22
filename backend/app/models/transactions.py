from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[str] = mapped_column(String, default="account_1", index=True, nullable=False)
    account_name: Mapped[str] = mapped_column(String, default="Account 1", nullable=False)
    trade_time: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    stock_code: Mapped[str] = mapped_column(String, index=True, nullable=False)
    stock_name: Mapped[str | None] = mapped_column(String, nullable=True)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    fee: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    screenshot_id: Mapped[int] = mapped_column(ForeignKey("screenshots.id"), nullable=False)

    screenshot = relationship("Screenshot", back_populates="transactions")
