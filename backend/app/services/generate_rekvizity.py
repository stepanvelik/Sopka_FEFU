"""Генерация .docx «Реквизиты» из шаблона (жёлтые поля → данные студента)."""

from __future__ import annotations

import os
import re
import shutil
import zipfile
from pathlib import Path

from app.services.generate_spravka import YELLOW_RUN_RE, _set_yellow_run_text, escape_xml
from app.services.generate_rso_application import remove_yellow_highlighting

DEFAULT_TEMPLATE = Path(__file__).resolve().parents[2] / "templates" / "rekvizity_template.docx"


def replace_yellow_runs_at_indices(xml: str, replacements: dict[int, str]) -> str:
    matches = list(YELLOW_RUN_RE.finditer(xml))
    for index in sorted(replacements.keys(), reverse=True):
        if index >= len(matches):
            continue
        match = matches[index]
        updated = _set_yellow_run_text(match.group(0), replacements[index])
        xml = xml[: match.start()] + updated + xml[match.end() :]
    return xml


def generate_rekvizity(
    data: dict[str, str],
    template_path: str | Path,
    output_path: str | Path,
    *,
    remove_yellow: bool = True,
) -> Path:
    template_path = Path(template_path)
    output_path = Path(output_path)
    tmp_path = output_path.with_suffix(output_path.suffix + "._tmp_.docx")
    shutil.copy2(template_path, tmp_path)

    with zipfile.ZipFile(tmp_path, "r") as zin:
        names = zin.namelist()
        contents = {name: zin.read(name) for name in names}

    xml = contents["word/document.xml"].decode("utf-8")
    xml = replace_yellow_runs_at_indices(
        xml,
        {
            0: data["fio"],
            1: data["birth_day"],
            2: data["birth_month"],
            3: data["birth_year"],
            4: data["passport_series_1"],
            5: data["passport_series_2"],
            6: data["passport_number"],
            7: data["passport_issue_day"],
            8: data["passport_issue_year_with_month"],
            9: data["passport_issued_by"],
            10: f"Адрес по прописке: {data['registration_address']}",
            11: "",
            12: "",
            13: "",
            14: "",
            15: "",
            16: "",
            17: "",
            18: "",
            19: f"Адрес фактический: {data['residential_address']}",
            20: "",
            21: "",
            22: "",
            23: "",
            24: "",
            25: "",
            26: "",
            27: data["snils_1"],
            28: data["snils_2"],
            29: data["snils_3"],
            30: data["snils_control"],
            31: data["inn"],
            32: data["account_number"],
            33: data["bik"],
            34: data["correspondent_account"],
        },
    )
    if remove_yellow:
        xml = remove_yellow_highlighting(xml)

    contents["word/document.xml"] = xml.encode("utf-8")

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, content in contents.items():
            zout.writestr(name, content)

    os.remove(tmp_path)
    return output_path


def make_filename(fio: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]', "", fio).replace(" ", "_")
    return f"Реквизиты_{safe}.docx"


def resolve_template_path() -> Path:
    env_path = os.environ.get("REKVIZITY_TEMPLATE_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)
    if DEFAULT_TEMPLATE.is_file():
        return DEFAULT_TEMPLATE
    raise FileNotFoundError(
        f"Шаблон реквизитов не найден: {DEFAULT_TEMPLATE}. "
        "Положите rekvizity_template.docx в backend/templates/ или задайте REKVIZITY_TEMPLATE_PATH."
    )
