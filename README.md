# Practitioner — Daily Practice Ledger

> A disciplined daily-practice PWA. Plan sessions, run the timer, log actuals, and export a PDF. All data stays on your device — no server, no account, no analytics.

---

## File Structure

```
practitioner-pwa/
├── index.html              ← App shell (single-file SPA)
├── manifest.json           ← Web App Manifest (PWA metadata)
├── sw.js                   ← Service Worker (offline + caching)
├── icon.svg                ← Master SVG icon (vector source)
├── icon-192.png            ← Standard PWA icon (192 × 192)
├── icon-512.png            ← Standard PWA icon (512 × 512)
├── icon-maskable-192.png   ← Maskable icon for Android (192 × 192)
├── icon-maskable-512.png   ← Maskable icon for Android (512 × 512)
├── apple-touch-icon.png    ← iOS home-screen icon (180 × 180)
├── favicon.ico             ← Browser tab favicon (16 / 32 / 48 px)
└── README.md               ← This file
```

---

## Quick Start (Local)

```bash
# Any static server works. Python example:
python3 -m http.server 8080 --directory practitioner-pwa

# Then open:
# http://localhost:8080/
```

> **Note:** Service Workers require either `localhost` or HTTPS. They will not register on plain `http://` non-localhost origins.

---

## Deployment

### GitHub Pages

1. Push the entire `practitioner-pwa/` folder to a repository (or into a `docs/` folder).
2. Go to **Settings → Pages** and set the source to the branch/folder you used.
3. Your app will be live at `https://<user>.github.io/<repo>/`.
4. Update `manifest.json` → `"start_url"` and `"scope"` to match your subdirectory if it isn't the root:
   ```json
   "start_url": "/<repo>/",
   "scope":     "/<repo>/"
   ```

### Netlify / Vercel (Root Deployment)

1. Drag-and-drop the `practitioner-pwa/` folder into Netlify, **or** connect your repo and set the publish directory.
2. The app deploys to your Netlify/Vercel domain root — no path changes needed.
3. For Netlify, add a `_redirects` file for SPA fallback:
   ```
   /*  /index.html  200
   ```

### Apache / Nginx

Copy the entire folder into your web root (or a subdirectory). For Apache, add an `.htaccess`:

```apache
Options -Indexes
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

For Nginx:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## Service Worker

`sw.js` uses a **cache-first** strategy for same-origin assets and a **network-first** strategy for external resources (Google Fonts).

### Cache Versioning

When you deploy a new version, bump the cache name in `sw.js`:

```js
// sw.js — line 1
const CACHE_NAME = 'practitioner-v2'; // ← increment this
```

The old cache is deleted automatically on activation.

### Precache List

The following URLs are pre-cached on install:

```
/Practitioner/
/Practitioner/index.html
/Practitioner/manifest.json
/Practitioner/icon-192.png
/Practitioner/icon-512.png
/Practitioner/apple-touch-icon.png
/Practitioner/favicon.ico
```

If your deployment path differs from `/Practitioner/`, update the `PRECACHE_URLS` array in `sw.js` to match.

---

## PWA Install

### Android (Chrome)
Chrome automatically shows an **"Add to Home Screen"** banner when all installability criteria are met (served over HTTPS, manifest present, SW registered). The app includes an in-app install button that appears when the `beforeinstallprompt` event fires.

### iOS (Safari)
Safari does not fire `beforeinstallprompt`. The app shows an iOS-specific install hint: tap the **Share** icon → **Add to Home Screen**. This hint is shown automatically when the app is opened in mobile Safari (not standalone mode).

---

## Bug Fixes Applied

| # | Location | Issue | Fix |
|---|----------|-------|-----|
| 1 | `index.html` head | Icon and manifest paths were absolute (`/Practitioner/…`) — break on any other host | Changed all asset `href`s to relative paths |
| 2 | `index.html` head | Missing `favicon.ico` link and SVG icon link | Added `<link rel="icon">` for `.ico` and `.svg` |
| 3 | Stale-SW cleanup script | Scope check used hardcoded `/Practitioner/` — would leave stale SWs on any other deployment path | Replaced with dynamic `new URL('./', location.href)` |
| 4 | SW registration | Hardcoded `scope: '/Practitioner/'` — fails when deployed elsewhere | Scope now derived from `document.baseURI` |
| 5 | SW registration | No update lifecycle — users on old code indefinitely | Added `updatefound` listener + `SKIP_WAITING` message + auto-reload |
| 6 | CSS comment (line 39) | `--ink-lift: #10142000` was fully transparent (alpha `00`) — comment said "BUG FIX" but the fix was already present | Confirmed the fix `rgba(16,20,32,0.92)` is retained |
| 7 | `manifest.json` | Missing `maskable` icon purpose — Android adaptive icons showed with white box | Added `icon-maskable-192.png` and `icon-maskable-512.png` with `"purpose": "maskable"` |
| 8 | `manifest.json` | Missing `shortcuts` array | Added "New Day" shortcut for Android long-press |

---

## Privacy

- All session data is stored in **`localStorage`** on the user's own device.
- No telemetry, no analytics, no server communication of any kind.
- PDF export is generated entirely in-browser using `html2canvas` + `jsPDF`.

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome / Edge 90+ | ✅ Full PWA install |
| Firefox 90+ | ✅ Runs; no install prompt |
| Safari 16.4+ | ✅ Full PWA install (iOS & macOS) |
| Samsung Internet | ✅ Full PWA install |

---

## Regenerating Icons

The master icon is `icon.svg`. To regenerate all PNGs:

```bash
pip install cairosvg Pillow

python3 - <<'EOF'
import cairosvg, io
from PIL import Image

sizes = {'icon-192.png':192,'icon-512.png':512,'apple-touch-icon.png':180,
         'icon-maskable-192.png':192,'icon-maskable-512.png':512}
for name, sz in sizes.items():
    cairosvg.svg2png(url='icon.svg', write_to=name, output_width=sz, output_height=sz)

imgs = [Image.open(io.BytesIO(cairosvg.svg2png(url='icon.svg',output_width=s,output_height=s))).convert('RGBA')
        for s in [16,32,48]]
imgs[0].save('favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48)], append_images=imgs[1:])
print("Done.")
EOF
```

---

*Practitioner — because the gap between planned and actual is data.*
