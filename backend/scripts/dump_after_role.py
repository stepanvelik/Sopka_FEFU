import re
import zipfile
from pathlib import Path

xml = zipfile.ZipFile(
    Path(__file__).resolve().parents[1] / "templates" / "spravka_template.docx"
).read("word/document.xml").decode("utf-8")

idx = xml.find(">роль</w:t>")
snippet = xml[idx : idx + 2500]
texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", snippet)
Path(__file__).resolve().parent.joinpath("after_role_texts.txt").write_text(
    "\n".join(texts), encoding="utf-8"
)
print("parts", len(texts))
