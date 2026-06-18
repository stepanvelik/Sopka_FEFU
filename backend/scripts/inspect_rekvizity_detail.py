import json
import re
import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "templates" / "rekvizity_template.docx"
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")

chunks = []
for match in re.finditer(r"<w:r[\s\S]*?</w:r>", xml):
    block = match.group(0)
    if "yellow" not in block:
        continue
    texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", block)
    chunks.append({
        "joined": "".join(texts),
        "parts": texts,
        "start": match.start(),
    })

out = Path(__file__).resolve().parent / "rekvizity_template_detail.json"
out.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")
print("chunks", len(chunks))
