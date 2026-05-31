import zipfile
from pathlib import Path

xml = zipfile.ZipFile(
    Path(__file__).resolve().parents[1] / "templates" / "spravka_template.docx"
).read("word/document.xml").decode("utf-8")

for kw in ("роль", "типовой", "тип мероприятия", "комментарий", "качестве"):
    idx = 0
    hits = []
    while True:
        idx = xml.find(kw, idx)
        if idx < 0:
            break
        hits.append(xml[max(0, idx - 150) : idx + len(kw) + 200])
        idx += len(kw)
    Path(__file__).resolve().parent.joinpath(f"dump_{kw.replace(' ', '_')}.txt").write_text(
        "\n---\n".join(hits), encoding="utf-8"
    )
    print(kw, len(hits))
