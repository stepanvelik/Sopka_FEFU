from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, BeforeValidator

from app.services.student_lookup import normalize_phone


def _coerce_optional_phone(value: int | str | None) -> str | None:
    if value is None or value == "":
        return None
    return normalize_phone(value)


def _coerce_required_phone(value: int | str) -> str:
    normalized = normalize_phone(value)
    if not normalized:
        raise ValueError("Некорректный номер телефона.")
    return normalized


OptionalPhone = Annotated[str | None, BeforeValidator(_coerce_optional_phone)]
RequiredPhone = Annotated[str, BeforeValidator(_coerce_required_phone)]


class StudentFindOrCreate(BaseModel):
    last_name: str = Field(..., max_length=100)
    first_name: str = Field(..., max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    phone: RequiredPhone


class StudentCreate(BaseModel):
    last_name: str = Field(..., max_length=100)
    first_name: str = Field(..., max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    birth_date: date

    study_group: str = Field(..., max_length=50)
    institute: str = Field(..., max_length=255)

    phone: OptionalPhone = None
    email: str | None = Field(None, max_length=255)
    corporate_email: str | None = Field(None, max_length=255)

    registration_address: str | None = None
    residential_address: str | None = None

    passport_series: str | None = Field(None, max_length=10)
    passport_number: str | None = Field(None, max_length=20)
    passport_issued_by: str | None = None
    passport_issue_date: date | None = None
    passport_department_code: str | None = Field(None, max_length=20)

    snils: str | None = Field(None, max_length=20)
    inn: str | None = Field(None, max_length=20)
    rso_member_ticket_no: str | None = Field(None, max_length=50)

    is_active: bool = True


class StudentUpdate(BaseModel):
    last_name: str | None = Field(None, max_length=100)
    first_name: str | None = Field(None, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    birth_date: date | None = None

    study_group: str | None = Field(None, max_length=50)
    institute: str | None = Field(None, max_length=255)

    phone: OptionalPhone = None
    email: str | None = Field(None, max_length=255)
    corporate_email: str | None = Field(None, max_length=255)

    registration_address: str | None = None
    residential_address: str | None = None

    passport_series: str | None = Field(None, max_length=10)
    passport_number: str | None = Field(None, max_length=20)
    passport_issued_by: str | None = None
    passport_issue_date: date | None = None
    passport_department_code: str | None = Field(None, max_length=20)

    snils: str | None = Field(None, max_length=20)
    inn: str | None = Field(None, max_length=20)
    rso_member_ticket_no: str | None = Field(None, max_length=50)

    is_active: bool | None = None


class StudentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: int
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date

    study_group: str
    institute: str

    phone: str | None
    email: str | None
    corporate_email: str | None

    registration_address: str | None
    residential_address: str | None

    passport_series: str | None
    passport_number: str | None
    passport_issued_by: str | None
    passport_issue_date: date | None
    passport_department_code: str | None

    snils: str | None
    inn: str | None
    rso_member_ticket_no: str | None

    is_active: bool
    created_at: datetime
    updated_at: datetime


class StudentFindOrCreateResponse(BaseModel):
    student: StudentRead
    created: bool
