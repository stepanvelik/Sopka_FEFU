from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.student import Student


class GphContractData(Base):
    __tablename__ = "gph_contract_data"

    gph_data_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    contract_number: Mapped[str | None] = mapped_column(String(50))
    contract_date: Mapped[date | None] = mapped_column(Date)
    contract_term_text: Mapped[str | None] = mapped_column(String(255))
    service_term_text: Mapped[str | None] = mapped_column(String(255))

    student_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("students.student_id", ondelete="CASCADE"))
    organization_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("organizations.organization_id", ondelete="SET NULL"))
    bank_details_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("bank_details.bank_details_id", ondelete="SET NULL"))

    full_name_nominative: Mapped[str | None] = mapped_column(String(255))
    last_name_only: Mapped[str | None] = mapped_column(String(100))
    initials: Mapped[str | None] = mapped_column(String(20))
    full_name_dative: Mapped[str | None] = mapped_column(String(255))
    last_name_dative: Mapped[str | None] = mapped_column(String(100))

    reward_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    reward_amount_text: Mapped[str | None] = mapped_column(String(500))

    customer_name: Mapped[str | None] = mapped_column(String(255))
    customer_status: Mapped[str | None] = mapped_column(String(255))
    customer_phone: Mapped[str | None] = mapped_column(String(30))
    customer_email: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[str] = mapped_column(String(50), server_default="подготовлено")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="gph_contract_data_rows")
