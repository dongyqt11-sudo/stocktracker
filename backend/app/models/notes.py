from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, default="", nullable=False)
    note_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    related_stock_code: Mapped[str | None] = mapped_column(String, nullable=True)
    related_screenshot_id: Mapped[int | None] = mapped_column(ForeignKey("screenshots.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    related_screenshot = relationship("Screenshot", back_populates="notes")
