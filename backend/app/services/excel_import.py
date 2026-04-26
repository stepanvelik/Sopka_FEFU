from __future__ import annotations

import io
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_details import BankDetails
from app.models.student import Student

ImportMode = Literal["update", "skip"]


@dataclass
class ImportResult:
    total: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    bank_created: int = 0
    bank_updated: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "total": self.total,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "failed": self.failed,
            "bank_created": self.bank_created,
            "bank_updated": self.bank_updated,
            "errors": self.errors,
            "warnings": self.warnings,
        }


class ExcelImportService:
    STUDENTS_FIELDS = [
        "last_name",
        "first_name",
        "middle_name",
        "birth_date",
        "study_group",
        "institute",
        "phone",
        "corporate_email",
        "registration_address",
        "residential_address",
        "passport_series",
        "passport_number",
        "passport_issued_by",
        "passport_issue_date",
        "passport_department_code",
        "snils",
        "inn",
    ]
    BANK_FIELDS = ["bank_name", "bik", "correspondent_account", "account_number"]
    REQUIRED_FIELDS = ["last_name", "first_name", "birth_date", "institute", "study_group"]
    COLUMN_ALIASES = {
        "last_name": ["фамилия", "last_name", "last name", "surname", "family name"],
        "first_name": ["имя", "first_name", "first name", "name", "given name"],
        "middle_name": ["отчество", "middle_name", "patronymic", "middle name"],
        "birth_date": ["дата рождения", "birth_date", "birth date", "date of birth", "день рождения"],
        "institute": [
            "институт",
            "institute",
            "школа",
            "school",
            "факультет",
            "faculty",
            "школа (институт)",
            "институт (школа)",
        ],
        "study_group": ["группа", "study_group", "group", "учебная группа", "академическая группа"],
        "phone": ["телефон", "phone", "phone number", "номер телефона", "контактный телефон"],
        "corporate_email": ["корпоративный email", "corporate_email", "корпоративная почта", "email", "почта", "e-mail"],
        "passport_series": ["серия паспорта", "passport_series", "серия", "passport series"],
        "passport_number": ["номер паспорта", "passport_number", "номер", "passport number"],
        "passport_issued_by": ["кем выдан", "passport_issued_by", "issued by", "кем выдан паспорт"],
        "passport_issue_date": ["дата выдачи", "passport_issue_date", "issue date", "дата выдачи паспорта"],
        "passport_department_code": ["код подразделения", "passport_department_code", "department code", "код подразделения паспорта"],
        "registration_address": ["адрес регистрации", "registration_address", "registration address", "прописка"],
        "residential_address": ["адрес проживания", "residential_address", "residential address", "фактический адрес"],
        "snils": ["снилс", "snils", "снилс номер", "страховой номер", "номер снилс"],
        "inn": ["инн", "inn", "инн номер", "номер инн", "идентификационный номер"],
        "bank_name": ["банк", "bank_name", "bank", "наименование банка", "название банка"],
        "bik": ["бик", "bik", "bik code", "бик банка"],
        "correspondent_account": ["корреспондентский счет", "correspondent_account", "корр. счет", "к/с"],
        "account_number": ["номер счета", "account_number", "account number", "расчетный счет", "р/с", "счет"],
    }

    def __init__(self) -> None:
        self.column_mapping: dict[str, str] = {}

    async def import_bytes(
        self,
        session: AsyncSession,
        file_bytes: bytes,
        mode: ImportMode = "update",
    ) -> ImportResult:
        result = ImportResult()
        df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
        result.total = len(df)
        if len(df) == 0:
            result.warnings.append("Файл пуст.")
            return result

        self.column_mapping = self._detect_columns(df)
        validated, validation_errors = self._validate_data(df)
        if validation_errors:
            result.errors.extend(validation_errors)
            return result

        for row_index, row in validated.iterrows():
            line = row_index + 2
            try:
                student_data = self._prepare_student(row)
                existing = await self._find_existing_student(session, student_data)

                if existing is not None:
                    if mode == "skip":
                        result.skipped += 1
                        continue

                    changed = self._apply_student_changes(existing, student_data)
                    if changed:
                        existing.updated_at = datetime.now().replace(tzinfo=None)
                        result.updated += 1
                    else:
                        result.skipped += 1
                    student_id = existing.student_id
                else:
                    student = Student(**student_data)
                    session.add(student)
                    await session.flush()
                    student_id = int(student.student_id)
                    result.created += 1

                bank_created, bank_updated, bank_error = await self._upsert_bank(session, row, student_id)
                result.bank_created += bank_created
                result.bank_updated += bank_updated
                if bank_error:
                    result.errors.append(f"Строка {line}: {bank_error}")

                await session.commit()
            except Exception as exc:
                await session.rollback()
                result.failed += 1
                result.errors.append(f"Строка {line}: {exc}")

        return result

    def _detect_columns(self, df: pd.DataFrame) -> dict[str, str]:
        excel_cols_lower = [str(c).strip().lower() for c in df.columns]
        mapping: dict[str, str] = {}
        found = set()
        for db_field, aliases in self.COLUMN_ALIASES.items():
            for alias in aliases:
                alias_l = alias.lower()
                if alias_l in excel_cols_lower:
                    idx = excel_cols_lower.index(alias_l)
                    original_name = str(df.columns[idx])
                    mapping[original_name] = db_field
                    found.add(db_field)
                    break
        missing_required = [field for field in self.REQUIRED_FIELDS if field not in found]
        if missing_required:
            msg = ", ".join(missing_required)
            raise ValueError(f"В файле отсутствуют обязательные колонки: {msg}")
        return mapping

    def _get_excel_column(self, db_field: str) -> str | None:
        for ex_col, db_col in self.column_mapping.items():
            if db_col == db_field:
                return ex_col
        return None

    def _validate_data(self, df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
        errors: list[str] = []
        validated = pd.DataFrame()
        for field in self.STUDENTS_FIELDS + self.BANK_FIELDS:
            col = self._get_excel_column(field)
            validated[field] = df[col].copy() if col else None

        for field in ["birth_date", "passport_issue_date"]:
            parsed_dates: list[date | None] = []
            for idx, val in enumerate(validated[field]):
                parsed, err = self._parse_date(val, field)
                if err:
                    errors.append(f"Строка {idx + 2}: {err}")
                parsed_dates.append(parsed)
            validated[field] = parsed_dates

        for field in self.REQUIRED_FIELDS:
            is_missing = validated[field].isna() | (validated[field].astype(str).str.strip() == "")
            if field == "birth_date":
                is_missing = validated[field].isna()
            if is_missing.any():
                rows = [i + 2 for i in validated[is_missing].index.tolist()]
                errors.append(f"Строки {rows}: отсутствует обязательное поле '{field}'")

        not_null_email = validated["corporate_email"].dropna()
        if len(not_null_email) > 0:
            invalid = ~not_null_email.astype(str).str.contains("@", na=False)
            if invalid.any():
                rows = [i + 2 for i in invalid[invalid].index.tolist()]
                errors.append(f"Строки {rows}: corporate_email должен содержать '@'")

        for field in ["snils", "inn"]:
            normalized = validated[field].map(self._normalize_id_field).dropna()
            duplicated = normalized[normalized.duplicated()]
            if len(duplicated) > 0:
                errors.append(f"Дубликаты {field} в файле: {list(duplicated.unique())}")
            validated[field] = validated[field].map(self._normalize_id_field)

        return validated, errors

    def _parse_date(self, value: Any, field_name: str) -> tuple[date | None, str | None]:
        if pd.isna(value) or value is None:
            return None, None
        try:
            parsed = pd.to_datetime(value, dayfirst=True).date()
            if parsed > date.today():
                return None, f"{field_name} не может быть из будущего"
            return parsed, None
        except Exception:
            return None, f"{field_name}: неверный формат даты '{value}'"

    def _clean(self, value: Any) -> str | None:
        if pd.isna(value) or value is None:
            return None
        s = str(value).strip()
        return s if s else None

    def _normalize_id_field(self, value: Any) -> str | None:
        if pd.isna(value) or value is None:
            return None
        s = str(value).strip()
        if not s:
            return None
        try:
            f = float(s)
            if f.is_integer():
                s = str(int(f))
        except ValueError:
            pass
        digits = "".join(ch for ch in s if ch.isdigit())
        return digits or None

    def _prepare_student(self, row: pd.Series) -> dict[str, Any]:
        student: dict[str, Any] = {}
        for field in self.STUDENTS_FIELDS:
            val = row.get(field)
            if field in ["birth_date", "passport_issue_date"]:
                student[field] = val
            elif field in ["snils", "inn"]:
                student[field] = self._normalize_id_field(val)
            elif field in ["last_name", "first_name", "study_group", "institute"]:
                student[field] = str(val).strip() if pd.notna(val) else None
            else:
                student[field] = self._clean(val)

        student["email"] = None
        student["rso_member_ticket_no"] = None
        student["is_active"] = True
        return student

    async def _find_existing_student(self, session: AsyncSession, student_data: dict[str, Any]) -> Student | None:
        snils = student_data.get("snils")
        if snils:
            snils_res = await session.execute(
                select(Student).where(Student.snils == snils).where(Student.is_active.is_(True)).limit(1)
            )
            by_snils = snils_res.scalar_one_or_none()
            if by_snils is not None:
                return by_snils

        inn = student_data.get("inn")
        if inn:
            inn_res = await session.execute(
                select(Student).where(Student.inn == inn).where(Student.is_active.is_(True)).limit(1)
            )
            by_inn = inn_res.scalar_one_or_none()
            if by_inn is not None:
                return by_inn

        if student_data.get("last_name") and student_data.get("first_name") and student_data.get("birth_date"):
            stmt = (
                select(Student)
                .where(Student.is_active.is_(True))
                .where(Student.last_name == student_data["last_name"])
                .where(Student.first_name == student_data["first_name"])
                .where(Student.birth_date == student_data["birth_date"])
            )
            if student_data.get("middle_name"):
                stmt = stmt.where(Student.middle_name == student_data["middle_name"])
            stmt = stmt.limit(1)
            fio_res = await session.execute(stmt)
            return fio_res.scalar_one_or_none()
        return None

    def _apply_student_changes(self, existing: Student, new_data: dict[str, Any]) -> bool:
        changed = False
        for field in self.STUDENTS_FIELDS:
            old_value = getattr(existing, field)
            new_value = new_data.get(field)
            if old_value != new_value:
                setattr(existing, field, new_value)
                changed = True
        return changed

    def _has_any_bank_data(self, row: pd.Series) -> bool:
        for field in self.BANK_FIELDS:
            value = row.get(field)
            if value is not None and pd.notna(value) and str(value).strip():
                return True
        return False

    def _prepare_bank(self, row: pd.Series) -> dict[str, Any]:
        return {
            "bank_name": self._clean(row.get("bank_name")),
            "bik": self._normalize_id_field(row.get("bik")),
            "correspondent_account": self._normalize_id_field(row.get("correspondent_account")),
            "account_number": self._normalize_id_field(row.get("account_number")),
            "is_active": True,
        }

    async def _upsert_bank(
        self,
        session: AsyncSession,
        row: pd.Series,
        student_id: int,
    ) -> tuple[int, int, str | None]:
        if not self._has_any_bank_data(row):
            return 0, 0, None

        bank_data = self._prepare_bank(row)
        if not bank_data["bank_name"] or not bank_data["bik"] or not bank_data["account_number"]:
            return 0, 0, "неполные банковские реквизиты (обязательны bank_name, bik, account_number)"

        bank_res = await session.execute(
            select(BankDetails)
            .where(BankDetails.student_id == student_id)
            .where(BankDetails.is_active.is_(True))
            .limit(1)
        )
        existing = bank_res.scalar_one_or_none()
        if existing is not None:
            existing.bank_name = bank_data["bank_name"]
            existing.bik = bank_data["bik"]
            existing.correspondent_account = bank_data["correspondent_account"]
            existing.account_number = bank_data["account_number"]
            return 0, 1, None

        session.add(BankDetails(student_id=student_id, **bank_data))
        return 1, 0, None
