from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.bank_details import BankDetails


class Student(Base):
    __tablename__ = "students"

    student_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    last_name: Mapped[str] = mapped_column(String(100))
    first_name: Mapped[str] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100))
    birth_date: Mapped[date] = mapped_column(Date)

    study_group: Mapped[str] = mapped_column(String(50))
    institute: Mapped[str] = mapped_column(String(255))

    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    corporate_email: Mapped[str | None] = mapped_column(String(255))

    registration_address: Mapped[str | None] = mapped_column(Text)
    residential_address: Mapped[str | None] = mapped_column(Text)

    passport_series: Mapped[str | None] = mapped_column(String(10))
    passport_number: Mapped[str | None] = mapped_column(String(20))
    passport_issued_by: Mapped[str | None] = mapped_column(Text)
    passport_issue_date: Mapped[date | None] = mapped_column(Date)
    passport_department_code: Mapped[str | None] = mapped_column(String(20))

    snils: Mapped[str | None] = mapped_column(String(20))
    inn: Mapped[str | None] = mapped_column(String(20))
    rso_member_ticket_no: Mapped[str | None] = mapped_column(String(50))

    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    bank_details_rows: Mapped[list["BankDetails"]] = relationship(
        "BankDetails",
        back_populates="student",
        passive_deletes=True,
    )
