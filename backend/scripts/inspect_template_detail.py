import json
import re
import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "templates" / "spravka_template.docx"
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")

# All w:t texts with nearby highlight flag
chunks = []
for m in re.finditer(r"<w:r[\s\S]*?</w:r>", xml):
    block = m.group(0)
    if "yellow" not in block:
        continue
    texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", block)
    chunks.append({"joined": "".join(texts), "parts": texts, "runs": block.count("<w:r")})

keywords = ["роль", "тип мероприятия", "ФИО", "группы", "1-2", "Название"]
filtered = [c for c in chunks if any(k in c["joined"] for k in keywords)]

out = Path(__file__).resolve().parent / "template_detail.json"
out.write_text(json.dumps(filtered, ensure_ascii=False, indent=2), encoding="utf-8")
print("chunks", len(chunks), "filtered", len(filtered))
