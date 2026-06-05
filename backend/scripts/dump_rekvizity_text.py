import re
import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "templates" / "rekvizity_template.docx"
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")

texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)
plain = "".join(texts)
# normalize for readability
plain = plain.replace("\xa0", " ")
print(plain)
