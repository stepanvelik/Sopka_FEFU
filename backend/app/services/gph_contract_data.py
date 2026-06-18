"""Resolve GPH contract fields for employment Excel export."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gph_contract_data import GphContractData

# Значения заказчика из примера заполнения формы ГПХ (одинаковые для всех договоров).
DEFAULT_CUSTOMER_NAME = (
    "Федеральное государственное автономное образовательное учреждение высшего образования "
    "«Дальневосточный федеральный университет»"
)
DEFAULT_CUSTOMER_STATUS = "в лице Департамента по работе с абитуриентами"
DEFAULT_CUSTOMER_PHONE = "8(423)243-11-94"
DEFAULT_CUSTOMER_EMAIL = "sopka@mail.dvfu.ru"

# Заглушки для демонстрации, если в БД нет записи gph_contract_data по студенту.
DEFAULT_CONTRACT_NUMBER = ""
DEFAULT_CONTRACT_DATE = date(2024, 6, 10)
DEFAULT_CONTRACT_TERM_TEXT = "10.07.2023 г. до 30.09.2024"
DEFAULT_SERVICE_TERM_TEXT = "10.06.2024 по 20.09.2024"
DEFAULT_REWARD_AMOUNT = Decimal("50000.00")
DEFAULT_REWARD_AMOUNT_TEXT = "пятидесяти тысяч рублей 00 копеек"


@dataclass(frozen=True)
class GphFields:
    contract_number: str
    contract_date: date | None
    contract_term_text: str
    service_term_text: str
    reward_amount: Decimal | None
    reward_amount_text: str
    customer_name: str
    customer_status: str
    customer_phone: str
    customer_email: str


def _format_contract_date(value: date | None) -> str:
    if value is None:
        return ""
    return value.strftime("%d.%m.%Y")


def _format_reward_amount(value: Decimal | None) -> str:
    if value is None:
        return ""
    normalized = value.quantize(Decimal("0.01"))
    if normalized == normalized.to_integral_value():
        return str(int(normalized))
    return format(normalized, "f")


def gph_fields_to_excel_values(fields: GphFields) -> dict[str, str]:
    return {
        "contract_number": fields.contract_number,
        "contract_date": _format_contract_date(fields.contract_date),
        "contract_term_text": fields.contract_term_text,
        "service_term_text": fields.service_term_text,
        "reward_amount": _format_reward_amount(fields.reward_amount),
        "reward_amount_text": fields.reward_amount_text,
        "customer_name": fields.customer_name,
        "customer_status": fields.customer_status,
        "customer_phone": fields.customer_phone,
        "customer_email": fields.customer_email,
    }


def _build_fields_from_record(record: GphContractData | None) -> GphFields:
    if record is None:
        return GphFields(
            contract_number=DEFAULT_CONTRACT_NUMBER,
            contract_date=DEFAULT_CONTRACT_DATE,
            contract_term_text=DEFAULT_CONTRACT_TERM_TEXT,
            service_term_text=DEFAULT_SERVICE_TERM_TEXT,
            reward_amount=DEFAULT_REWARD_AMOUNT,
            reward_amount_text=DEFAULT_REWARD_AMOUNT_TEXT,
            customer_name=DEFAULT_CUSTOMER_NAME,
            customer_status=DEFAULT_CUSTOMER_STATUS,
            customer_phone=DEFAULT_CUSTOMER_PHONE,
            customer_email=DEFAULT_CUSTOMER_EMAIL,
        )

    return GphFields(
        contract_number=(record.contract_number or "").strip(),
        contract_date=record.contract_date or DEFAULT_CONTRACT_DATE,
        contract_term_text=(record.contract_term_text or "").strip() or DEFAULT_CONTRACT_TERM_TEXT,
        service_term_text=(record.service_term_text or "").strip() or DEFAULT_SERVICE_TERM_TEXT,
        reward_amount=record.reward_amount if record.reward_amount is not None else DEFAULT_REWARD_AMOUNT,
        reward_amount_text=(record.reward_amount_text or "").strip() or DEFAULT_REWARD_AMOUNT_TEXT,
        customer_name=(record.customer_name or "").strip() or DEFAULT_CUSTOMER_NAME,
        customer_status=(record.customer_status or "").strip() or DEFAULT_CUSTOMER_STATUS,
        customer_phone=(record.customer_phone or "").strip() or DEFAULT_CUSTOMER_PHONE,
        customer_email=(record.customer_email or "").strip() or DEFAULT_CUSTOMER_EMAIL,
    )


async def resolve_gph_fields(session: AsyncSession, student_id: int) -> GphFields:
    stmt = (
        select(GphContractData)
        .where(GphContractData.student_id == student_id)
        .order_by(GphContractData.created_at.desc(), GphContractData.gph_data_id.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    return _build_fields_from_record(record)
