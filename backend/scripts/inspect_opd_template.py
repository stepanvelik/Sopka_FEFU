"""Инспекция жёлтых полей в шаблоне «Согласие ОПД»."""
import json
import re
import sys
import zipfile
from pathlib import Path

DEFAULT = Path(__file__).resolve().parents[1] / "templates" / "opd_consent_template.docx"
p = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT

with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")

chunks = []
for m in re.finditer(r"<w:r[\s\S]*?</w:r>", xml):
    block = m.group(0)
    if "yellow" not in block:
        continue
    texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", block)
    chunks.append({"joined": "".join(texts), "parts": texts, "runs": block.count("<w:r")})

out = Path(__file__).resolve().parent / "opd_template_detail.json"
out.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")
print("chunks", len(chunks))
for i, c in enumerate(chunks):
    print(f"{i}: {c['joined']!r}")

all_text = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)
print("\n--- document text ---\n")
print("".join(all_text))
