"""Build the order-list pages from the Google Sheets export.

Usage:  python scripts/build_lists.py ["imports/African Violet varieties.xlsx"]

Reads each sheet, keeps rows whose Available column is 'L' (leaves available),
extracts the picture anchored to each row, shrinks it for the web and writes a
static HTML page per list. Re-run whenever the spreadsheet changes.
"""
import html, io, re, sys, zipfile
from datetime import date
from pathlib import Path
import openpyxl
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parent.parent
XLSX = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "imports" / "African Violet varieties.xlsx"
BASE = "https://grahamgk2.github.io/MzanziAfricanViolets"
NS = {"x": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"}

# One entry per list. cols are 0-based column indexes in the sheet.
LISTS = [
    dict(sheet="Parent Plants", drawing=1, photo_col=0, page="african-violets.html", folder="violets",
         name=1, desc=2, type=3, hybridizer=4, avail=9, extra=None,
         title="African Violet Leaves for Sale South Africa | Mzanzi African Violets",
         h1="African Violet Cultivars", noun="African violet",
         intro="Leaves of the African violet varieties currently available from our collection."),
    dict(sheet="Species", drawing=2, photo_col=2, page="species.html", folder="species",
         name=1, desc=3, type=None, hybridizer=None, avail=6, extra=4,
         title="Species Streptocarpus (Saintpaulia) Leaves South Africa | Mzanzi African Violets",
         h1="Species African Violets (Streptocarpus)", noun="species",
         intro="Leaves of species currently available. African violets are now classed as Streptocarpus (formerly Saintpaulia)."),
]


def clean(v):
    s = "" if v is None else str(v)
    s = re.sub(r"(?<=\d)�(?=\d)", "–", s).replace("�", "")
    return re.sub(r"\s+", " ", s).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "item"


def row_images(z, n):
    """Map 0-based sheet row -> image bytes for drawing n."""
    rels = z.read(f"xl/drawings/_rels/drawing{n}.xml.rels").decode()
    target = dict(re.findall(r'Id="(rId\d+)"[^>]*?Target="([^"]+)"', rels))
    target.update({a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*?Id="(rId\d+)"', rels)})
    xml = z.read(f"xl/drawings/drawing{n}.xml").decode()
    out = {}
    for blk in re.findall(r"<xdr:twoCellAnchor.*?</xdr:twoCellAnchor>", xml, flags=re.S):
        row = int(re.search(r"<xdr:from>.*?<xdr:row>(\d+)</xdr:row>", blk, flags=re.S).group(1))
        rid = re.search(r'r:embed="(rId\d+)"', blk).group(1)
        out[row] = z.read("xl/" + target[rid].replace("../", ""))
    return out


def save_thumb(data, path, width=480):
    im = Image.open(io.BytesIO(data))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=78, optimize=True, progressive=True)
    return im.width, im.height


def card(i, item, cfg, img):
    esc = html.escape
    meta = []
    if item["type"]:
        meta.append(f'<span class="type">{esc(item["type"])}</span>')
    if item["hybridizer"]:
        meta.append(f'<span class="hyb">Hybridiser: {esc(item["hybridizer"])}</span>')
    pic = ""
    if img:
        pic = (f'<img src="images/{cfg["folder"]}/{img[0]}" width="{img[1]}" height="{img[2]}" '
               f'alt="{esc(item["name"])} {cfg["noun"]} flower" loading="lazy">')
    extra = ""
    if item["extra"]:
        extra = f'<details><summary>Growing notes</summary><p>{esc(item["extra"])}</p></details>'
    return (f'<li class="card" data-name="{esc(item["name"], True)}" data-search="{esc((item["name"]+" "+item["desc"]+" "+item["hybridizer"]).lower(), True)}">'
            f'{pic}<div class="body"><h3>{esc(item["name"])}</h3>{"".join(meta)}'
            f'<p>{esc(item["desc"])}</p>{extra}'
            f'<div class="qty" role="group" aria-label="Sets of two leaves of {esc(item["name"], True)}">'
            f'<button type="button" class="minus" aria-label="Fewer">&minus;</button>'
            f'<output>0</output>'
            f'<button type="button" class="plus" aria-label="More">+</button>'
            f'<span>sets of 2 leaves</span></div></div></li>')


PAGE = """<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{base}/{page}">
<link rel="stylesheet" href="css/style.css">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_ZA">
</head>
<body>
<header class="site-header">
<p class="brand"><a href="index.html">Mzanzi African Violets</a></p>
<nav aria-label="Main"><a href="index.html">Home</a><a href="plants.html" aria-current="page">Plants</a><a href="care.html">African Violet Care</a><a href="location.html">Location</a><a href="contact.html">Orders &amp; Contact</a></nav>
</header>
<main class="wide">
<h1>{h1}</h1>
<p>{intro} {count} available. Last updated {updated}.</p>
<p>Leaves are sold in sets of two for R30 per set. <strong>Minimum order: 5 sets (R150)</strong>, plus postage. Choose your sets below, then send the order to us. We reply with an invoice that lists what is available, the postage quote and our banking details. See <a href="contact.html">Orders &amp; Contact</a>.</p>
<p><a href="plants.html">&larr; All plant lists</a></p>
<label class="find">Search this list <input type="search" id="find" placeholder="Name, colour, hybridiser"></label>
<ul class="cards" id="cards">
{cards}
</ul>
<section id="basket" class="basket" aria-live="polite" hidden>
<h2>Your order</h2>
<ul id="lines"></ul>
<p id="summary"></p>
<p id="warn" class="warn" hidden></p>
<p class="actions"><a id="mail" class="btn" href="#">Email this order</a> <button type="button" id="copy" class="btn">Copy order text</button></p>
<p class="small">To order by WhatsApp (username @ggoode.sa) or Facebook Messenger, copy the order text and paste it into your message. Prices exclude postage.</p>
</section>
</main>
<footer>
<p>&copy; 2026 Graham Goode. All rights reserved. Mzanzi African Violets &ndash; Pringle Bay, Western Cape, South Africa.</p>
</footer>
<script>window.ORDER={{label:{label},email:"mzanziafricanviolets@gmail.com",setPrice:30,minSets:5}};</script>
<script src="js/order.js"></script>
</body>
</html>
"""


def main():
    import json
    wb = openpyxl.load_workbook(XLSX, read_only=False)
    z = zipfile.ZipFile(XLSX)
    for cfg in LISTS:
        ws = wb[cfg["sheet"]]
        imgs = row_images(z, cfg["drawing"])
        folder = ROOT / "images" / cfg["folder"]
        for old in folder.glob("*.jpg"):
            old.unlink()
        items, seen = [], set()
        for r, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=1):
            if not row[cfg["name"]] or clean(row[cfg["avail"]]).upper() != "L":
                continue
            g = lambda k: clean(row[cfg[k]]) if cfg[k] is not None else ""
            name = g("name")
            s = slug(name)
            while s in seen:
                s += "-2"
            seen.add(s)
            img = None
            if r in imgs:
                try:
                    w, h = save_thumb(imgs[r], folder / f"{s}.jpg")
                    img = (f"{s}.jpg", w, h)
                except Exception as e:
                    print(f"  WARNING: unreadable photo for {name!r} (sheet row {r + 1}): {e}")
            items.append((dict(name=name, desc=g("desc"), type=g("type"), hybridizer=g("hybridizer"), extra=g("extra")), img))
        items.sort(key=lambda t: t[0]["name"].lower())
        cards = "\n".join(card(i, it, cfg, img) for i, (it, img) in enumerate(items))
        desc = (f"{cfg['intro']} Sets of two leaves from R30, minimum order 5 sets. "
                "Courier delivery across South Africa from Pringle Bay, Western Cape.")
        out = PAGE.format(title=html.escape(cfg["title"]), desc=html.escape(desc, True), base=BASE, page=cfg["page"],
                          h1=html.escape(cfg["h1"]), intro=html.escape(cfg["intro"]), count=f"{len(items)} varieties",
                          updated=date.today().strftime("%d %B %Y").lstrip("0"), cards=cards,
                          label=json.dumps(cfg["h1"]))
        (ROOT / cfg["page"]).write_text(out, encoding="utf-8")
        missing = sum(1 for _, im in items if not im)
        print(f"{cfg['page']}: {len(items)} items, {missing} without photo")


if __name__ == "__main__":
    main()
