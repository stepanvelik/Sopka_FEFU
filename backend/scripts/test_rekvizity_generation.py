from pathlib import Path

from app.services.generate_rekvizity import generate_rekvizity, resolve_template_path

sample = {
    "fio": "Петров Пётр Петрович",
    "birth_day": "15",
    "birth_month": "03",
    "birth_year": "2002",
    "passport_series_1": "12",
    "passport_series_2": "34",
    "passport_number": "567890",
    "passport_issue_day": "20",
    "passport_issue_year_with_month": "апреля 2018",
    "passport_issued_by": "УМВД России по г. Москве",
    "registration_address": "г. Москва, ул. Ленина, д. 1, кв. 2",
    "residential_address": "г. Москва, ул. Пушкина, д. 10, кв. 5",
    "snils_1": "123",
    "snils_2": "456",
    "snils_3": "789",
    "snils_control": "01",
    "inn": "123456789012",
    "account_number": "40817810000000000001",
    "bik": "044525225",
    "correspondent_account": "30101810400000000225",
}

out = Path(__file__).resolve().parents[1] / "_rekvizity_test.docx"
generate_rekvizity(sample, resolve_template_path(), out)
print("written", out)
