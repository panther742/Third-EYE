# Third Eye — push hua: https://github.com/panther742/Third-EYE

## 🚀 PUSHA DI GAYI! (commit 0f44486, branch main, 468 files)

Ab bas ye **turant karo** ⚠️:

1. Kholo: https://github.com/settings/tokens
2. Apne token ki list mein `third-eye` wale token ke saamne **Delete** dabao
   (token chat mein aaya tha — security ke liye revoke zaroori hai)

Repo ab live hai: https://github.com/panther742/Third-EYE

## Kaise chalayein apne computer se:

```bash
git clone https://github.com/panther742/Third-EYE.git
cd Third-EYE
npm install
# TomTom key ke liye .env banao:
echo "TOMTOM_API_KEY=UPAu9fz5d69jXLWVG4wKYK66yWnCC7oF" > .env
npm run dev
# → http://localhost:4173
```


Ye folder tumhari app ke **saare custom features ka backup** hai, aur isme
wo script bhi hai jo **GitHub ka naya update** laata hai.

---

## 📁 Is folder mein kya hai

| Item | Kya hai |
|---|---|
| `custom-files/` | Hamari saari badli hui + nayi files ka **exact backup** (16 files) |
| `PATCHES.md` | Ye file — har customization ki list |
| `update-from-github.sh` | GitHub se update laane wali script |

---

## 🔄 GitHub se update kaise laaye

Mujhe bas bolo: **"GitHub se update lao"** — main ye karunga:

1. `bash /home/user/update-from-github.sh` chalaunga
2. Script **fresh repo clone** karegi (sabse naya version)
3. Hamari **16 custom files** wapas copy hogi
4. **Conflicts** (jahan dono ne same file badli) — **main khud solve karunga**
5. Dependencies install + server start

⚠️ Upstream repo June 2026 ke baad bada restructure kar chuka hai (naya
`server/` folder aaya hai). Isliye update ke waqt conflicts aayenge hi —
wo mera kaam hai, tumhe sirf bolna hai aur preview check karna.

---

## 🛠️ Apna NAYA feature kaise add kare

Mujhe chat mein bolo kya chahiye — jaise:
- "Mumbai ko home city bana do"
- "Camera heights badal do"
- "Naya data layer add karo"
- "Logo change karo"

Main add kar dunga, aur **backup bhi turant refresh** kar dunga taaki
update ke waqt wo feature kabhi kho na ho.

---

## ✅ Hamare custom features ki list (backup mein hai)

| # | Feature | File(s) |
|---|---|---|
| 1 | **THIRD EYE** branding (title, header, loader) | `index.html`, `src/main.js` |
| 2 | **Surat city boot** (banjad zamin fix) | `src/camera.js`, `src/main.js` |
| 3 | **Stale URL hash ignore** (reload pe purani jagah nahi) | `src/sharelink.js` |
| 4 | **Live layers default ON** (flights/military/satellites/quakes/launches) | `src/data/layerState.js` (storage key v3) |
| 5 | **Keyless world search** (Nominatim fallback — Google key zaroori nahi) | `src/locations.js` |
| 6 | **10 Indian cities + landmarks** pills (Surat, Mumbai, Delhi, Taj...) | `src/locations.js` |
| 7 | **🇮🇳 INDIA CAMS** (Dwarkadhish live embed, Somnath, Golden Temple, Surat Smart City) | `src/indiaCams.js` (NAYA file), `index.html`, `style.css`, `src/main.js` |
| 8 | **🌐 HOME toggle** (globe ↔ Surat, tracking release ke saath) | `src/ui.js`, `src/camera.js` (`flyToHomeCity`) |
| 9 | **CCTV nearest-camera open** (India se bhi live feed turant) | `src/data/cctv.js` |
| 10 | **Google-Maps-style HYBRID view** (labels + roads overlay Esri imagery pe) | `src/mapStackController.js` |
| 11 | **Scope mask default OFF** (full open view, no circle) | `src/scopeMask.js`, `index.html`, `src/sharelink.js` |
| 12 | **URL hash writing OFF** (address bar clean) | `src/sharelink.js` |
| 13 | **Preview embed allowed** (`GEV_ALLOW_EMBED=1`) | `vite.config.js` |
| 14 | **TomTom live traffic key** configured | `.env` (TOMTOM_API_KEY) |
| 15 | Dev tools (browser screenshot tests) | `tools/live-check.mjs`, `tools/hybrid-check.mjs` |

---

## 🔑 Keys (.env)

- `TOMTOM_API_KEY` — live traffic (LIVE hai, daily 40K tile budget)
- Baaki free keys jab chahiye: AISStream (ships), FIRMS (fires) — POWER UP se ya `.env` mein

**Note:** `.env` kabhi GitHub pe push mat karna — wo `.gitignore` mein already hai.
