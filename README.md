# Mzanzi African Violets website

Static website (plain HTML/CSS) for Mzanzi African Violets, Pringle Bay, Western Cape.
Hosted free on GitHub Pages.

## Licences
- **Code** (HTML templates, CSS): MIT, see `LICENSE`.
- **Content** (text, photos, plant descriptions, PDFs): (c) Graham Goode, all rights reserved.

## Set up GitHub Pages
1. Create a GitHub repo named `YOURNAME.github.io` (public) so the site is served at the root: `https://grahamgk2.github.io/MzanziAfricanViolets/`.
2. Copy these files into the repo, then:
   ```
   git init && git add . && git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/YOURNAME.github.io.git
   git push -u origin main
   ```
3. On GitHub: Settings > Pages > deploy from branch `main`, folder `/ (root)`.

## Before going live
- Search all files for `TODO` and fill them in.
- Replace `https://grahamgk2.github.io/MzanziAfricanViolets` with your real address in every `.html` file (canonical tags), `sitemap.xml`, `robots.txt` and the JSON-LD block in `index.html`. In VS Code use Find in Files (Ctrl+Shift+F) then Replace All.
- Add photos to `images/` (home page expects `images/hero.jpg`). Give each `<img>` meaningful `alt` text.
- Add PDFs to `pdfs/` and list them in `pdfs.html`.

## Preview locally
```
python -m http.server 8000
```
Then open http://localhost:8000

## Google Search Console (free)
1. Add a "URL prefix" property for your site address.
2. Verify with the HTML file method: download the file Google gives you, put it in the repo root, push, then click Verify.
3. Submit `sitemap.xml`.
4. Re-submit/inspect pages after big changes.

## Later: custom .co.za domain
Add a file named `CNAME` containing just the domain, set the DNS records GitHub lists, then update the address everywhere (see above).
