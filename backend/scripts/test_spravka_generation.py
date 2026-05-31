import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.fio_inflection import fio_to_dative
from app.services.generate_spravka import generate_spravka, resolve_template_path

def event_type_to_genitive(name: str) -> str:
    mapping = {
        "Олимпиада": "олимпиады",
        "Волонтёрский проект": "волонтёрского проекта",
    }
    return mapping.get(name, name.lower())

def role_to_comment(role: str) -> str:
    return "волонтёра"

PLACEHOLDERS = [
    "ФИО студента",
    "название группы",
    "1-2",
    "тип мероприятия",
    "Название мероприятия",
    ">роль</w:t>",
]

payload = {
    "fio": fio_to_dative("Иванов", "Иван", "Иванович"),
    "fio_nominative": "Иванов Иван Иванович",
    "group": "Б9120-09.03.03пи",
    "dates": "5-6 декабря, с 08:00 до 19:00",
    "event_type": event_type_to_genitive("Олимпиада"),
    "event_name": "Студенческая весна 2024",
    "role": role_to_comment("Волонтёр"),
}

out = Path(__file__).resolve().parent / "_test_spravka.docx"
generate_spravka(payload, resolve_template_path(), out)

with zipfile.ZipFile(out) as zf:
    xml = zf.read("word/document.xml").decode("utf-8")

left = [item for item in PLACEHOLDERS if item in xml]
print("event_type:", payload["event_type"])
print("role:", payload["role"])
print("has role genitive:", payload["role"] in xml)
print("leftover placeholders:", left or "none")
print("has fio:", payload["fio"] in xml)
print("has event name:", payload["event_name"] in xml)

out.unlink()
sys.exit(1 if left else 0)
