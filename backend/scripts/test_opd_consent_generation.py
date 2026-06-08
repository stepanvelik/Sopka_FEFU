"""Проверка генерации «Согласие ОПД» на тестовых данных."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.generate_opd_consent import generate_opd_consent, resolve_opd_template_path

sample = {
    "fio": "Петров Пётр Петрович",
    "registration_address": "Приморский край, г. Владивосток, ул. Ленина, д. 1, кв. 10",
    "passport_country": "Российская Федерация",
    "passport_series": "4012",
    "passport_number": "345678",
    "passport_issued_by": "УМВД России по Приморскому краю",
    "passport_issue_day_month": "15.03.",
    "passport_issue_year_1": "20",
    "passport_issue_year_2": "19",
    "initials_fio": "П. П. Петров",
    "consent_date": "«01» июня 2026 г.",
}

out = Path(__file__).resolve().parents[1] / "_opd_consent_test.docx"
generate_opd_consent(sample, resolve_opd_template_path(), out)
print("written:", out)
