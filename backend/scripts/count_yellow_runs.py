import re
import zipfile
from pathlib import Path

from app.services.generate_spravka import YELLOW_RUN_RE

p = Path(__file__).resolve().parents[1] / "templates" / "rekvizity_template.docx"
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")

for index, match in enumerate(YELLOW_RUN_RE.finditer(xml)):
    text_match = re.search(r"<w:t[^>]*>([^<]*)</w:t>", match.group(0), re.DOTALL)
    text = text_match.group(1) if text_match else ""
    print(index, repr(text))

print("total", len(list(YELLOW_RUN_RE.finditer(xml))))
