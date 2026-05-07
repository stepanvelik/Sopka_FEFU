from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, Numeric, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Event(Base):
    __tablename__ = "events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_name: Mapped[str] = mapped_column(String(500))
    event_level: Mapped[str] = mapped_column(String(50))
    organizer_name: Mapped[str | None] = mapped_column(String(255))
    organization_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("organizations.organization_id", ondelete="SET NULL"))

    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)

    participants_planned: Mapped[int | None] = mapped_column(Integer)
    duration_hours: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

