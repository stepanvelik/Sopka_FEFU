from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student

PLACEHOLDER_BIRTH_DATE = date(2000, 1, 1)
PLACEHOLDER_STUDY_GROUP = "—"
PLACEHOLDER_INSTITUTE = "—"


def normalize_phone(phone: int | str | None) -> str | None:
    if phone is None:
        return None
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    return digits or None


async def find_student_by_phone(session: AsyncSession, phone: int | str) -> Student | None:
    normalized = normalize_phone(phone)
    if not normalized:
        return None
    result = await session.execute(
        select(Student)
        .where(func.regexp_replace(Student.phone, r"\D", "", "g") == normalized)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def find_or_create_student(
    session: AsyncSession,
    *,
    last_name: str,
    first_name: str,
    middle_name: str | None,
    phone: int | str,
) -> tuple[Student, bool]:
    normalized_phone = normalize_phone(phone)
    if not normalized_phone:
        raise ValueError("Некорректный номер телефона.")
    existing = await find_student_by_phone(session, normalized_phone)
    if existing is not None:
        return existing, False

    student = Student(
        last_name=last_name.strip(),
        first_name=first_name.strip(),
        middle_name=middle_name.strip() if middle_name else None,
        birth_date=PLACEHOLDER_BIRTH_DATE,
        study_group=PLACEHOLDER_STUDY_GROUP,
        institute=PLACEHOLDER_INSTITUTE,
        phone=normalized_phone,
        is_active=True,
    )
    session.add(student)
    await session.flush()
    return student, True
