import re
import zipfile
from pathlib import Path

xml = zipfile.ZipFile(
    Path(__file__).resolve().parents[1] / "templates" / "spravka_template.docx"
).read("word/document.xml").decode("utf-8")

idx = xml.find(">1-2</w:t>")
snippet = xml[max(0, idx - 500) : idx + 2000]
texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", snippet)
Path(__file__).resolve().parent.joinpath("dates_context.txt").write_text(
    "\n".join(texts), encoding="utf-8"
)
