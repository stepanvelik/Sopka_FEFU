from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.student import Student


class BankDetails(Base):
    __tablename__ = "bank_details"

    bank_details_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("students.student_id", ondelete="CASCADE"))

    bank_name: Mapped[str] = mapped_column(String(255))
    bik: Mapped[str] = mapped_column(String(20))
    correspondent_account: Mapped[str | None] = mapped_column(String(30))
    account_number: Mapped[str] = mapped_column(String(30))

    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="bank_details_rows")
