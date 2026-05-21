from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[str] = mapped_column(String, default="account_1", index=True, nullable=False)
    account_name: Mapped[str] = mapped_column(String, default="Account 1", nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    screenshot_type: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_ai_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)

    holdings = relationship("Holding", back_populates="screenshot")
    transactions = relationship("Transaction", back_populates="screenshot")
    assets_daily = relationship("AssetsDaily", back_populates="screenshot")
    notes = relationship("Note", back_populates="related_screenshot")
