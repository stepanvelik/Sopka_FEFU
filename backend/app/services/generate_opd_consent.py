"""Генерация .docx «Согласие ОПД» из шаблона (жёлтые поля → данные студента)."""

from __future__ import annotations

import os
import re
import shutil
import zipfile
from pathlib import Path

from app.services.generate_rekvizity import replace_yellow_runs_at_indices
from app.services.generate_rso_application import remove_yellow_highlighting

DEFAULT_TEMPLATE = Path(__file__).resolve().parents[2] / "templates" / "opd_consent_template.docx"


def generate_opd_consent(
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
            1: data["registration_address"],
            2: "",
            3: "",
            4: "",
            5: "",
            6: "",
            7: "",
            8: "",
            9: data.get("passport_country", "Российская Федерация"),
            10: data["passport_series"],
            11: data["passport_number"],
            12: data["passport_issued_by"],
            13: data["passport_issue_day_month"],
            14: data["passport_issue_year_1"],
            15: data["passport_issue_year_2"],
            16: data["initials_fio"],
        },
    )

    consent_date = data.get("consent_date", "")
    if consent_date:
        xml = re.sub(
            r"«01»\s+июня\s+\d{4}\s+г\.",
            consent_date,
            xml,
            count=1,
        )

    if remove_yellow:
        xml = remove_yellow_highlighting(xml)

    contents["word/document.xml"] = xml.encode("utf-8")

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, content in contents.items():
            zout.writestr(name, content)

    os.remove(tmp_path)
    return output_path


def make_opd_filename(fio: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]', "", fio).replace(" ", "_")
    return f"Согласие_ОПД_{safe}.docx"


def resolve_opd_template_path() -> Path:
    env_path = os.environ.get("OPD_CONSENT_TEMPLATE_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)
    if DEFAULT_TEMPLATE.is_file():
        return DEFAULT_TEMPLATE
    raise FileNotFoundError(
        f"Шаблон согласия ОПД не найден: {DEFAULT_TEMPLATE}. "
        "Положите opd_consent_template.docx в backend/templates/ или задайте OPD_CONSENT_TEMPLATE_PATH."
    )
