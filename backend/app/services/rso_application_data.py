"""Сбор данных для заявления в РСО из БД (без склонений)."""

from __future__ import annotations

from datetime import date
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student


async def build_rso_application_payload(
    session: AsyncSession,
    *,
    student_id: int,
) -> dict[str, str]:
    """Собирает данные студента для подстановки в заявление РСО."""
    
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Студент не найден.")
    
    # ФИО
    full_name = f"{student.last_name} {student.first_name}"
    if student.middle_name:
        full_name += f" {student.middle_name}"
    
    # Форматирование дат
    birth_date_str = student.birth_date.strftime("%d.%m.%Y") if student.birth_date else ""
    passport_date_str = student.passport_issue_date.strftime("%d.%m.%Y") if student.passport_issue_date else ""
    
    # Дата заявления с АВТОМАТИЧЕСКИМ ТЕКУЩИМ ГОДОМ
    current_year = date.today().year
    application_date_str = f"«01» июня {current_year} г."
    
    return {
        "full_name": full_name,              
        "birth_date": birth_date_str,        
        "registration_address": student.registration_address or "",
        "residential_address": student.residential_address or "",
        "phone": str(student.phone) if student.phone else "",
        "email": (student.corporate_email or student.email or "").strip(),
        "passport_series": student.passport_series or "",
        "passport_number": student.passport_number or "",
        "passport_issued_by": student.passport_issued_by or "",
        "passport_issue_date": passport_date_str,
        "passport_department_code": student.passport_department_code or "",
        "application_date": application_date_str,  # ← здесь уже готовый формат
    }