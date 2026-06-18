"""Сбор данных для «Согласие ОПД» из БД."""

from __future__ import annotations

import re
from datetime import date

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

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


def _format_initials(student: Student) -> str:
    first = f"{student.first_name.strip()[0]}." if student.first_name and student.first_name.strip() else ""
    middle = f"{student.middle_name.strip()[0]}." if student.middle_name and student.middle_name.strip() else ""
    last = (student.last_name or "").strip()
    if first and middle:
        return f"{first} {middle} {last}"
    if first:
        return f"{first} {last}"
    return last


def _format_passport_issue_parts(value: date | None) -> tuple[str, str, str]:
    if value is None:
        return "", "", ""
    year = f"{value.year:04d}"
    return f"{value.day:02d}.{value.month:02d}.", year[:2], year[2:]


def _missing_opd_fields(student: Student) -> list[str]:
    missing: list[str] = []
    if not _student_full_name(student).strip():
        missing.append("ФИО")
    if not (student.registration_address or "").strip():
        missing.append("Адрес регистрации")
    if not _digits_only(student.passport_series, max_len=4):
        missing.append("Серия паспорта")
    if not _digits_only(student.passport_number, max_len=6):
        missing.append("Номер паспорта")
    if not (student.passport_issued_by or "").strip():
        missing.append("Кем выдан паспорт")
    if student.passport_issue_date is None:
        missing.append("Дата выдачи паспорта")
    return missing


async def build_opd_consent_payload(
    session: AsyncSession,
    *,
    student_id: int,
) -> dict[str, str]:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")

    missing = _missing_opd_fields(student)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Для студента {_student_full_name(student)} не заполнены поля: {', '.join(missing)}.",
        )

    issue_day_month, issue_year_1, issue_year_2 = _format_passport_issue_parts(student.passport_issue_date)
    current_year = date.today().year
    consent_month = MONTH_GENITIVE[date.today().month]

    return {
        "fio": _student_full_name(student),
        "registration_address": (student.registration_address or "").strip(),
        "passport_country": "Российская Федерация",
        "passport_series": _digits_only(student.passport_series, max_len=4),
        "passport_number": _digits_only(student.passport_number, max_len=6),
        "passport_issued_by": (student.passport_issued_by or "").strip(),
        "passport_issue_day_month": issue_day_month,
        "passport_issue_year_1": issue_year_1,
        "passport_issue_year_2": issue_year_2,
        "initials_fio": _format_initials(student),
        "consent_date": f"«01» {consent_month} {current_year} г.",
    }
