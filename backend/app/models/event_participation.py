from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EventParticipation(Base):
    __tablename__ = "event_participation"

    participation_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("students.student_id", ondelete="CASCADE")
    )
    event_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("events.event_id", ondelete="CASCADE")
    )
    role_name: Mapped[str] = mapped_column(String(100))
    participation_status: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    time_slots: Mapped[list["EventParticipationTimeSlot"]] = relationship(
        "EventParticipationTimeSlot",
        back_populates="participation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("student_id", "event_id", name="uq_event_participation"),
    )
