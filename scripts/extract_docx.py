import zipfile
import re
import sys

path = sys.argv[1]
out = sys.argv[2]

with zipfile.ZipFile(path) as z:
    xml = z.read("word/document.xml").decode("utf-8")

text = re.sub(r"</w:p>", "\n", xml)
text = re.sub(r"<w:tab[^>]*/>", "\t", text)
text = re.sub(r"<[^>]+>", "", text)
for a, b in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')]:
    text = text.replace(a, b)

with open(out, "w", encoding="utf-8") as f:
    f.write(text)

print(len(text))
