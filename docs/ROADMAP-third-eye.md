# 🚀 THIRD EYE — Roadmap (upstream-inspired, humara apna twist)

Upstream: [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (MIT) — ideas with attribution.
Hamara repo: panther742/Third-EYE · Live: third-eye-theta.vercel.app · APK: v1.4+

## ✅ Already ahead of upstream (humari khud ki):
- **Live Trains layer** — Entur (Norway) + Digitraffic (Finland) + MBTA (Boston); follow-cam; upstream me sirf Transit hai (positions nahi)
- **Vercel serverless API** — static hosting par bhi saare proxies live (upstream sirf Node server)
- **Android APK** — signed, WebView-hardened (v1.4)
- **LOCATION search** — /api/geocode proxy + 3-tier fallback + offline gazetteer
- **India CCTV boards** — Dwarkadhish/Somnath/Golden Temple official YouTube live
- **3-country mirror resilience** — Overpass kumi/lz4 fallback chain (upstream #648 se pehle humne Vercel par kiya)

## 🎯 Phase 1 — upstream ideas jo humare stack par fit hain (sab keyless):
1. ✅ **Wind layer** DONE — Open-Meteo keyless grid arrows (windLayer.js, token h)
2. ✅ **ISS Pass predictor** DONE — 🛰 button in LOCATION bar (voice + tap)
3. **Contact trails** — flights/ships ke peeche trail lines (contactTrailRenderer pattern)
4. **Transit layer** — GTFS-RT buses/trams (generic; feeds per-city)
5. **Fire anchors + labels** — FIRMS fires par clickable info

## 🎯 Phase 2 — Third-Eye-only (upstream me NAHI):
6. **Trains India-jugaad** — NTES scraping proxy (unofficial, legal-grey — user decision)
7. **Voice commands Hindi** — "Surat dikhao", "trains on karo" (existing voice + Hinglish parser)
8. **APK auto-update** — GitHub Releases se in-app update check
9. **Scene Director presets** — "Hollywood style" camera chases (cockpit/CTIA/over-the-shoulder)
10. **Multi-user watch parties** — same camera share (WebRTC, later)

## 🔒 Standing rules:
- Sab REAL data, free/keyless priority; keys sirf env vars mein
- God's Eye branding kabhi visible nahi (sirf README license line)
- App name: THIRD EYE
