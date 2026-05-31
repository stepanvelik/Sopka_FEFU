import json
import re
import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "templates" / "spravka_template.docx"
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")

blocks = re.findall(r"(<w:r[^>]*>.*?<w:highlight w:val=\"yellow\"/>.*?</w:r>)", xml, re.DOTALL)
fields = []
for block in blocks:
    texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", block)
    fields.append("".join(texts))

out = Path(__file__).resolve().parent / "template_fields.json"
out.write_text(json.dumps(fields, ensure_ascii=False, indent=2), encoding="utf-8")
print("written", out, "count", len(fields))
