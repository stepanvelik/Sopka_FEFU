from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Numeric, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EventParticipationTimeSlot(Base):
    __tablename__ = "event_participation_time_slots"

    participation_time_slot_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    participation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("event_participation.participation_id", ondelete="CASCADE"),
    )

    participation_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    participation_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    participation: Mapped["EventParticipation"] = relationship(
        "EventParticipation",
        back_populates="time_slots",
    )

    __table_args__ = (
        UniqueConstraint(
            "participation_id",
            "participation_date",
            "start_time",
            "end_time",
            name="uq_event_participation_time_slot",
        ),
    )
