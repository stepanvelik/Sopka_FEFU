import re
import zipfile
from pathlib import Path

from app.services.generate_spravka import YELLOW_RUN_RE

xml = zipfile.ZipFile(Path(__file__).resolve().parents[1] / "templates" / "rekvizity_template.docx").read(
    "word/document.xml"
).decode("utf-8")
for index, match in enumerate(YELLOW_RUN_RE.finditer(xml)):
    print(index, repr(match.group(1)))
