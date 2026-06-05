"""Сбор данных документа «Реквизиты» из БД (студент + банковские реквизиты)."""

from __future__ import annotations

import re
from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bank_details import BankDetails
from app.models.student import Student

MONTH_GENITIVE = (
    "",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)


def _student_full_name(student: Student) -> str:
    return " ".join(part for part in (student.last_name, student.first_name, student.middle_name) if part)


def _digits_only(value: str | None, *, max_len: int | None = None) -> str:
    digits = re.sub(r"\D", "", value or "")
    if max_len is not None:
        return digits[:max_len]
    return digits


def _format_date_parts(value: date | None) -> tuple[str, str, str]:
    if value is None:
        return "", "", ""
    return f"{value.day:02d}", f"{value.month:02d}", f"{value.year:04d}"


def _format_issue_month(value: date | None) -> str:
    if value is None or not 1 <= value.month <= 12:
        return ""
    return MONTH_GENITIVE[value.month]


def _format_passport_series(value: str | None) -> tuple[str, str]:
    digits = _digits_only(value, max_len=4).ljust(4, "0")
    return digits[:2], digits[2:4]


def _format_snils_parts(value: str | None) -> tuple[str, str, str, str]:
    digits = _digits_only(value, max_len=11).ljust(11, "0")
    return digits[:3], digits[3:6], digits[6:9], digits[9:11]


def _pick_active_bank_details(rows: list[BankDetails]) -> BankDetails | None:
    active_rows = [row for row in rows if row.is_active]
    candidates = active_rows or rows
    if not candidates:
        return None
    return max(candidates, key=lambda row: row.bank_details_id)


def _missing_rekvizity_fields(student: Student, bank_details: BankDetails | None) -> list[str]:
    missing: list[str] = []
    if not _student_full_name(student).strip():
        missing.append("ФИО")
    if student.birth_date is None:
        missing.append("Дата рождения")
    if not _digits_only(student.passport_series, max_len=4):
        missing.append("Серия паспорта")
    if not _digits_only(student.passport_number, max_len=6):
        missing.append("Номер паспорта")
    if not (student.passport_issued_by or "").strip():
        missing.append("Кем выдан паспорт")
    if student.passport_issue_date is None:
        missing.append("Дата выдачи паспорта")
    if not (student.registration_address or "").strip():
        missing.append("Адрес по прописке")
    if not _digits_only(student.snils, max_len=11):
        missing.append("СНИЛС")
    if not _digits_only(student.inn, max_len=12):
        missing.append("ИНН")
    if bank_details is None:
        missing.append("Банковские реквизиты")
    else:
        if not (bank_details.account_number or "").strip():
            missing.append("Номер счета")
        if not _digits_only(bank_details.bik, max_len=9):
            missing.append("БИК")
    return missing


async def build_rekvizity_payload(
    session: AsyncSession,
    *,
    student_id: int,
) -> dict[str, str]:
    stmt = (
        select(Student)
        .options(selectinload(Student.bank_details_rows))
        .where(Student.student_id == student_id)
    )
    result = await session.execute(stmt)
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")

    bank_details = _pick_active_bank_details(list(student.bank_details_rows))
    missing = _missing_rekvizity_fields(student, bank_details)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Для студента {_student_full_name(student)} не заполнены поля: {', '.join(missing)}.",
        )

    birth_day, birth_month, birth_year = _format_date_parts(student.birth_date)
    passport_series_1, passport_series_2 = _format_passport_series(student.passport_series)
    passport_number = _digits_only(student.passport_number, max_len=6).ljust(6, "0")
    issue_day, _, issue_year = _format_date_parts(student.passport_issue_date)
    issue_month = _format_issue_month(student.passport_issue_date)
    issue_year_with_month = f"{issue_month} {issue_year}".strip()
    snils_1, snils_2, snils_3, snils_control = _format_snils_parts(student.snils)

    registration_address = (student.registration_address or "").strip()
    residential_address = (student.residential_address or "").strip() or registration_address

    assert bank_details is not None
    account_number = _digits_only(bank_details.account_number, max_len=20)
    bik = _digits_only(bank_details.bik, max_len=9)
    correspondent_account = _digits_only(bank_details.correspondent_account, max_len=23)

    return {
        "fio": _student_full_name(student),
        "birth_day": birth_day,
        "birth_month": birth_month,
        "birth_year": birth_year,
        "passport_series_1": passport_series_1,
        "passport_series_2": passport_series_2,
        "passport_number": passport_number,
        "passport_issue_day": issue_day,
        "passport_issue_year_with_month": issue_year_with_month,
        "passport_issued_by": (student.passport_issued_by or "").strip(),
        "registration_address": registration_address,
        "residential_address": residential_address,
        "snils_1": snils_1,
        "snils_2": snils_2,
        "snils_3": snils_3,
        "snils_control": snils_control,
        "inn": _digits_only(student.inn, max_len=12),
        "account_number": account_number,
        "bik": bik,
        "correspondent_account": correspondent_account,
    }
