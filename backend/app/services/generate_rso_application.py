"""Генерация .docx заявления в РСО из шаблона (жёлтые поля → данные)."""

from __future__ import annotations

import os
import re
import shutil
import zipfile
from pathlib import Path

# Берём готовые функции из существующего generate_spravka.py
from app.services.generate_spravka import (
    YELLOW_RUN_RE,
    escape_xml,
    replace_yellow_substring,
)

DEFAULT_RSO_TEMPLATE = Path(__file__).resolve().parents[2] / "templates" / "rso_application_template.docx"

# Шаблон для создания желтого run (берём из generate_spravka.py)
YELLOW_RUN = (
    "<w:r>"
    "<w:rPr>"
    "<w:color w:val=\"000000\"/>"
    "<w:sz w:val=\"28\"/><w:szCs w:val=\"28\"/>"
    "<w:highlight w:val=\"yellow\"/>"
    "</w:rPr>"
    "<w:t xml:space=\"preserve\">{text}</w:t>"
    "</w:r>"
)


def remove_yellow_highlighting(xml: str) -> str:
    """
    Удаляет желтое выделение из XML документа.
    
    Удаляет теги <w:highlight w:val="yellow"/> и их вариации,
    оставляя текст без выделения.
    """
    # Удаляем тег <w:highlight w:val="yellow"/> (с пробелами в конце)
    xml = re.sub(
        r'<w:highlight\s+w:val="yellow"\s*/>',
        '',
        xml
    )
    
    # Удаляем тег <w:highlight w:val="yellow"></w:highlight> (открывающий и закрывающий)
    xml = re.sub(
        r'<w:highlight\s+w:val="yellow"\s*>\s*</w:highlight>',
        '',
        xml
    )
    
    # Удаляем любые другие варианты тега highlight с yellow
    xml = re.sub(
        r'<w:highlight[^>]*w:val="yellow"[^>]*/>',
        '',
        xml
    )
    
    # Удаляем пустые теги <w:rPr> которые могли остаться
    xml = re.sub(
        r'<w:rPr>\s*</w:rPr>',
        '',
        xml
    )
    
    return xml


def generate_rso_application(
    data: dict[str, str], 
    template_path: str | Path, 
    output_path: str | Path,
    remove_yellow: bool = True
) -> Path:
    """
    Генерирует заявление в РСО, заменяя желтые поля.
    
    Args:
        data: Словарь с данными для подстановки
        template_path: Путь к шаблону .docx
        output_path: Путь для сохранения результата
        remove_yellow: Удалять ли желтое выделение после замены (по умолчанию True)
    """
    
    template_path = Path(template_path)
    output_path = Path(output_path)
    tmp_path = output_path.with_suffix(output_path.suffix + "._tmp_.docx")
    shutil.copy2(template_path, tmp_path)
    
    with zipfile.ZipFile(tmp_path, "r") as zin:
        names = zin.namelist()
        contents = {name: zin.read(name) for name in names}
    
    xml = contents["word/document.xml"].decode("utf-8")
    
    substitutions = [
        ("ФИО студента", data["full_name"]),
        ("дата рождения", data["birth_date"]),
        ("адрес регистрации", data["registration_address"]),
        ("адрес фактический", data["residential_address"]),
        ("телефон", data["phone"]),
        ("email", data["email"]),
        ("паспорт серия", data["passport_series"]),
        ("паспорт номер", data["passport_number"]),
        ("паспорт выдан", data["passport_issued_by"]),
        ("паспорт дата", data["passport_issue_date"]),
        ("паспорт код", data["passport_department_code"]),
        ("дата заявления", data["application_date"]),
    ]
    
    for anchor, value in substitutions:
        xml = replace_yellow_substring(xml, anchor, value)
    
    # Удаляем желтое выделение (если нужно)
    if remove_yellow:
        xml = remove_yellow_highlighting(xml)
    
    contents["word/document.xml"] = xml.encode("utf-8")
    
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, content in contents.items():
            zout.writestr(name, content)
    
    os.remove(tmp_path)
    return output_path


def make_rso_filename(full_name: str) -> str:
    """Создает имя файла для заявления."""
    safe = re.sub(r'[\\/:*?"<>|]', "", full_name).replace(" ", "_")
    return f"Заявление_РСО_{safe}.docx"


def resolve_rso_template_path() -> Path:
    """Определяет путь к шаблону заявления."""
    env_path = os.environ.get("RSO_APPLICATION_TEMPLATE_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)
    if DEFAULT_RSO_TEMPLATE.is_file():
        return DEFAULT_RSO_TEMPLATE
    raise FileNotFoundError(
        f"Шаблон заявления РСО не найден: {DEFAULT_RSO_TEMPLATE}. "
        "Положите rso_application_template.docx в backend/templates/"
    )