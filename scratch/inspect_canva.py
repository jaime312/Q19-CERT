import re

with open("canva_raw.html", "r", encoding="utf-8") as f:
    html = f.read()

# Let's search for media.canva.com links
links = re.findall(r'https://media\.canva\.com/v2/[^\s"\'\\}]+', html)
print(f"Found {len(links)} Canva media links:")
for l in list(set(links))[:20]:
    print("-", l)
