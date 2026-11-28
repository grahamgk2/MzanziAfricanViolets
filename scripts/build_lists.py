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
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
XLSX = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "imports" / "African Violet varieties.xlsx"
BASE = "https://grahamgk2.github.io/MzanziAfricanViolets"
NS = {"x": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"}

# One entry per list. cols are 0-based column indexes in the sheet.
LISTS = [
    dict(sheet="Parent Plants", key="cultivars", label="African violet cultivars", price=30,
         drawing=1, photo_col=0, page="african-violets.html", folder="violets",
         name=1, desc=2, type=3, hybridizer=4, avail=9, extra=None,
         title="African Violet Leaves for Sale South Africa | Mzanzi African Violets",
         h1="African Violet Cultivars", noun="African violet",
         note="This is a hobby, not a commercial greenhouse, so stock is limited and varies.",
         intro="Leaves of the African violet varieties currently available from our collection."),
    dict(sheet="Species", key="species", label="Species African violets", price=30, note="This is a hobby, not a commercial greenhouse, so stock is limited and varies.", drawing=2, photo_col=2, page="species.html", folder="species",
         name=0, desc=3, type=None, hybridizer=None, avail=6, extra=4, group=True,
         title="Species Streptocarpus (Saintpaulia) Leaves South Africa | Mzanzi African Violets",
         h1="Species African Violets (Streptocarpus)", noun="species",
         intro="Leaves of species currently available. African violets are now classed as Streptocarpus (formerly Saintpaulia)."),
]


# Headings for the AVSA species codes (K. Barbi 2019; J. Smith and W. Goretsky 2018).
# Saintpaulia is now classified as Streptocarpus section Saintpaulia (Nishii et al. 2015).
# Corrections to names in the spreadsheet. Remove an entry once the sheet itself is fixed.
NAME_FIXES = {
    "S. 5c1. cl. ionanthus House of Amani": "S. 5c1. cl. House of Amani",
    "S. 5c1. cl. ionanthus Mather 'A'": "S. 5c1. cl. Mather 'A'",
    "S. 5c1. cl. ionanthus Mather 'B'": "S. 5c1. cl. Mather 'B'",
    "S. 5c2. cl. diplotrichus #3083": "S. 5c2. cl. #3083",
    "S. 5c2. cl. diplotrichus Parker": "S. 5c2. cl. Parker",
    "S. 5c2. cl. diplotrichus Punter No. 0": "S. 5c2. cl. Punter No. 0",
    "S. 5c2. cl. diplotrichus Variegata Pink": "S. 5c2. cl. Variegata Pink",
    "S. 5c2. cl. diplotrichus Variegata White": "S. 5c2. cl. Variegata White",
}

GROUPS = {
    "1": "S. 1. inconspicuus", "2": "S. 2. afroviola", "3": "S. 3. shumensis", "4": "S. 4. teitensis",
    "5": "S. 5. ionanthus", "5a": "S. 5a. subspecies grandifolius", "5b": "S. 5b. subspecies grotei",
    "5c": "S. 5c. subspecies ionanthus", "5c1": "S. 5c1. variety ionanthus", "5c2": "S. 5c2. variety diplotrichus",
    "5d": "S. 5d. subspecies mafiensis", "5e": "S. 5e. subspecies occidentalis", "5f": "S. 5f. subspecies orbicularis",
    "5g": "S. 5g. subspecies pendulus", "5h": "S. 5h. subspecies rupicolus", "5i": "S. 5i. subspecies velutinus",
    "6": "S. 6. brevipilosus", "7": "S. 7. nitidus", "8": "S. 8. ulugurensis", "9": "S. 9. goetzeanus",
    "10": "S. 10. watkinsii",
}


def code_of(name):
    """'S. 5b. cl. grotei Amani' -> '5b'; '' if the name has no code."""
    m = re.match(r"S\.\s*(\d+)([a-z]?)(\d*)\.", name)
    return "".join(m.groups()) if m else ""


def chain_of(code):
    """'5c1' -> ['5', '5c', '5c1'];  '3' -> ['3'];  '' -> ['']."""
    m = re.match(r"(\d+)([a-z]?)(\d*)$", code)
    if not m:
        return [code]
    n, letter, digit = m.groups()
    out = [n]
    if letter:
        out.append(n + letter)
    if digit:
        out.append(n + letter + digit)
    return out


def code_key(code):
    m = re.match(r"(\d+)([a-z]?)(\d*)$", code)
    return (int(m.group(1)), m.group(2), int(m.group(3) or 0)) if m else (999, "", 0)


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
            f'<button type="button" class="toggle" aria-pressed="false">Add to order &middot; R{cfg["price"]}</button>'
            f'</div></li>')


PAGE = """<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{base}/{page}">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="css/style.css?v=3">
<script src="js/theme.js"></script>
<script src="js/basket.js?v=3" defer></script>
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="icons/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_ZA">
</head>
<body>
<header class="site-header">
<p class="brand"><a href="index.html"><img src="icons/logo-72.png" alt="" width="36" height="36">Mzanzi African Violets</a></p>
<nav aria-label="Main"><a href="index.html">Home</a><a href="plants.html" aria-current="page">Plants</a><a href="care.html">African Violet Care</a><a href="propagation.html">Leaf Propagation</a><a href="location.html">Location</a><a href="contact.html">Orders and Contact</a></nav>
</header>
<main class="wide">
<h1>{h1}</h1>
<p>{intro} {count} available. Last updated {updated}.</p>
{note}
<p>Leaves are sold in sets of two, and <strong>only one set per cultivar</strong> can be ordered. The <strong>minimum order is R150</strong> across all our lists, plus postage. Add leaves to your order below, review it in the order box at the bottom of the page, and send it to us. We reply with an invoice that lists what is available, the postage quote and our banking details. See <a href="contact.html">Orders and Contact</a>.</p>
<p><a href="plants.html">&larr; All plant lists</a></p>
<label class="find">Search this list <input type="search" id="find" placeholder="Name, colour, hybridiser"></label>
<div id="cards">
{cards}
</div>
<section id="basket" class="basket" aria-label="Your order" hidden>
<button type="button" id="basket-head" class="basket-head" aria-expanded="true" aria-controls="basket-body"><span id="basket-summary">Your order</span><span class="chev" aria-hidden="true"></span></button>
<div id="basket-body" class="basket-body"></div>
</section>
</main>
<footer>
<p>&copy; 2026 Graham Goode. All rights reserved. Mzanzi African Violets &ndash; Pringle Bay, Western Cape, South Africa. <a href="privacy.html">Privacy</a></p>
</footer>
<script>window.ORDER={{listKey:{listkey},label:{label},price:{price}}};</script>
<script src="js/order.js?v=3" defer></script>
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
            name = NAME_FIXES.get(g("name"), g("name"))
            s = slug(name)
            while s in seen:
                s += "-2"
            seen.add(s)
            img = None
            # A file in imports/photo-overrides/<slug>.(jpg|jpeg|png|webp) replaces the spreadsheet photo.
            data = None
            for ext in ("jpg", "jpeg", "png", "webp"):
                f = ROOT / "imports" / "photo-overrides" / f"{s}.{ext}"
                if f.exists():
                    data = f.read_bytes()
                    break
            if data is None and r in imgs:
                data = imgs[r]
            if data is not None:
                try:
                    w, h = save_thumb(data, folder / f"{s}.jpg")
                    img = (f"{s}.jpg", w, h)
                except Exception as e:
                    print(f"  WARNING: damaged photo for {ascii(name)} (sheet row {r + 1}, save as imports/photo-overrides/{s}.jpg to replace it): {e}")
            items.append((dict(name=name, desc=g("desc"), type=g("type"), hybridizer=g("hybridizer"), extra=g("extra")), img))
        if cfg.get("group"):
            for it, _ in items:
                it["code"] = code_of(it["name"])
            items.sort(key=lambda t: (code_key(t[0]["code"]), t[0]["name"].lower()))
            nodes = {}

            def node(c):
                return nodes.setdefault(c, {"cards": [], "kids": set()})

            for i, (it, img) in enumerate(items):
                chain = chain_of(it["code"])
                for parent, child in zip(chain, chain[1:]):
                    node(parent)["kids"].add(child)
                node(chain[-1])["cards"].append(card(i, it, cfg, img))
                node(chain[0])

            def render(c, depth):
                n = node(c)
                label = GROUPS.get(c, c or "Other").removeprefix("S. ")
                lvl = min(depth + 2, 4)
                nl = chr(10)
                out = f'<section class="grp-sec"><h{lvl}>{html.escape(label)}</h{lvl}>' + nl
                if n["cards"]:
                    out += '<ul class="cards">' + nl + nl.join(n["cards"]) + nl + "</ul>" + nl
                for k in sorted(n["kids"], key=code_key):
                    out += render(k, depth + 1)
                return out + "</section>"

            roots = sorted({chain_of(it["code"])[0] for it, _ in items}, key=code_key)
            cards = chr(10).join(render(c, 0) for c in roots)
        else:
            items.sort(key=lambda t: t[0]["name"].lower())
            cards = '<ul class="cards">\n' + "\n".join(card(i, it, cfg, img) for i, (it, img) in enumerate(items)) + "\n</ul>"
        desc = (f"{cfg['intro']} Sets of two leaves from R30, minimum order R150. "
                "Courier delivery across South Africa from Pringle Bay, Western Cape.")
        out = PAGE.format(title=html.escape(cfg["title"]), desc=html.escape(desc, True), base=BASE, page=cfg["page"],
                          h1=html.escape(cfg["h1"]), note=(f'<p><em>{html.escape(cfg["note"])}</em></p>' if cfg["note"] else ""), intro=html.escape(cfg["intro"]), count=f"{len(items)} varieties",
                          updated=date.today().strftime("%d %B %Y").lstrip("0"), cards=cards,
                          label=json.dumps(cfg["label"]), listkey=json.dumps(cfg["key"]), price=cfg["price"])
        (ROOT / cfg["page"]).write_text(out, encoding="utf-8")
        missing = sum(1 for _, im in items if not im)
        print(f"{cfg['page']}: {len(items)} items, {missing} without photo")


if __name__ == "__main__":
    main()
