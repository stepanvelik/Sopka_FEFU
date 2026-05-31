"""Генерация .docx справки о пропуске пар из шаблона (жёлтые поля → данные)."""

from __future__ import annotations

import os
import re
import shutil
import zipfile
from pathlib import Path

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

YELLOW_RUN_RE = re.compile(
    r"<w:r(?:[^>]*)>"
    r"(?:<w:rPr>(?:(?!</w:rPr>).)*"
    r'<w:highlight w:val="yellow"/>(?:(?!</w:rPr>).)*</w:rPr>)?'
    r"\s*<w:t[^>]*>([^<]*)</w:t>"
    r"\s*</w:r>",
    re.DOTALL,
)

DEFAULT_TEMPLATE = Path(__file__).resolve().parents[2] / "templates" / "spravka_template.docx"


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _yellow_run_text(run_xml: str) -> str:
    match = re.search(r"<w:t[^>]*>([^<]*)</w:t>", run_xml, re.DOTALL)
    return match.group(1) if match else ""


def _set_yellow_run_text(run_xml: str, text: str) -> str:
    return re.sub(
        r"(<w:t[^>]*>)([^<]*)(</w:t>)",
        lambda match: f"{match.group(1)}{escape_xml(text)}{match.group(3)}",
        run_xml,
        count=1,
        flags=re.DOTALL,
    )


def replace_yellow_substring(xml: str, anchor_text: str, new_value: str) -> str:
    """Заменяет подстроку внутри одного жёлтого run (якорь не обязан занимать весь run)."""
    pos = 0
    while True:
        match = YELLOW_RUN_RE.search(xml, pos)
        if not match:
            break
        run_xml = match.group(0)
        text = match.group(1)
        if anchor_text not in text:
            pos = match.end()
            continue
        updated = _set_yellow_run_text(run_xml, text.replace(anchor_text, new_value, 1))
        return xml[: match.start()] + updated + xml[match.end() :]
    return xml


def replace_yellow_dates_block(xml: str, anchor_text: str, new_value: str) -> str:
    """
    Находит run с датой (якорь 1-2), поглощает следующие жёлтые runs (время)
    и подставляет полную строку дат, сохраняя префикс «, о том что он ».
    """
    match = None
    for candidate in YELLOW_RUN_RE.finditer(xml):
        if anchor_text in candidate.group(1):
            match = candidate
            break
    if not match:
        return xml

    start = match.start()
    end = match.end()
    first_text = match.group(1)
    prefix = first_text.split(anchor_text, 1)[0]
    replacement_text = f"{prefix}{new_value}"

    yellow_run_pat = re.compile(
        r"\s*<w:r(?:[^>]*)>"
        r"(?:<w:rPr>(?:(?!</w:rPr>).)*"
        r'<w:highlight w:val="yellow"/>(?:(?!</w:rPr>).)*</w:rPr>)?'
        r"\s*<w:t[^>]*>.*?</w:t>"
        r"\s*</w:r>",
        re.DOTALL,
    )
    while True:
        nxt = yellow_run_pat.match(xml, end)
        if nxt:
            end = nxt.end()
        else:
            break

    replacement = YELLOW_RUN.format(text=escape_xml(replacement_text))
    return xml[:start] + replacement + xml[end:]


def generate_spravka(data: dict[str, str], template_path: str | Path, output_path: str | Path) -> Path:
    template_path = Path(template_path)
    output_path = Path(output_path)
    tmp_path = output_path.with_suffix(output_path.suffix + "._tmp_.docx")
    shutil.copy2(template_path, tmp_path)

    with zipfile.ZipFile(tmp_path, "r") as zin:
        names = zin.namelist()
        contents = {name: zin.read(name) for name in names}

    xml = contents["word/document.xml"].decode("utf-8")

    xml = replace_yellow_dates_block(xml, "1-2", data["dates"])
    substitutions = [
        ("ФИО студента", data["fio"]),
        ("название группы", data["group"]),
        ("тип мероприятия", data["event_type"]),
        ("Название мероприятия", data["event_name"]),
        ("роль", data["role"]),
    ]
    for anchor, value in substitutions:
        before = xml
        xml = replace_yellow_substring(xml, anchor, value)
        if xml == before and anchor == "роль":
            xml = replace_yellow_substring(
                xml,
                "роль типовой комментарий для этой справки",
                value,
            )

    contents["word/document.xml"] = xml.encode("utf-8")

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, content in contents.items():
            zout.writestr(name, content)

    os.remove(tmp_path)
    return output_path


def make_filename(fio: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]', "", fio).replace(" ", "_")
    return f"Справка_{safe}.docx"


def resolve_template_path() -> Path:
    env_path = os.environ.get("SPRAVKA_TEMPLATE_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)
    if DEFAULT_TEMPLATE.is_file():
        return DEFAULT_TEMPLATE
    raise FileNotFoundError(
        f"Шаблон справки не найден: {DEFAULT_TEMPLATE}. "
        "Положите spravka_template.docx в backend/templates/ или задайте SPRAVKA_TEMPLATE_PATH."
    )
