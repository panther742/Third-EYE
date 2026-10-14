<div align="center">

# 👁️ THIRD EYE

### **Har jagah dekho. Sab kuch dekho. — A real-time eye on planet Earth.**

Live aircraft, military jets, satellites, earthquakes, rocket launches, road traffic aur public cameras — sab ek jagah, ek globe pe, **real-time** mein. India-first experience ke saath.

*Har cheez jo dikh rahi hai, wo sach mein ho rahi hai — abhi, is second.*

</div>

---

<div align="center">

**[Quick Start](#-quick-start) · [Kya Live Hai](#-kya-live-hai) · [India Features](#-india-features) · [Apne Computer Pe Chalao](#-apne-computer-pe-chalao) · [Keys](#-keys-optional)**

</div>

---

## 🌍 Third Eye kyu?

Duniya already bol rahi hai — flight transponders, ship beacons, satellites, seismographs, traffic sensors, public cameras. **Third Eye** in sab ko ek globe pe jodta hai, taaki tum global picture se kisi ek plane, ek junction, ya ek camera tak ja sako — ek click mein.

Ye India ke ek developer ke Surat-first vision se bana hai: **globe khule to Surat dikhe, planes asli dikhe, aur naam bhi apne hon.**

---

## 🎛️ Kya-kya kar sakte ho

- **🛩️ Cockpit view** — kisi bhi live flight ke andar baith jao, camera saath-chalte terrain ke saath utarta hai
- **📡 Contacts (250 km)** — apne target ke aas-paas ka sab kuch: planes, vessels, sites — ek-ek karke dekho
- **🎯 Click-to-track** — kisi bhi contact pe click: camera lock, trail, poori metadata
- **🇮🇳 INDIA CAMS** — Dwarkadhish, Somnath, Golden Temple ke **official live darshan** + Surat Smart City
- **🗺️ Hybrid map** — satellite imagery + real road names + city labels (Google-Maps style)
- **🎨 Sensor styles** — Normal, CRT, NVG, FLIR thermal, Anime, Noir, Snow — ek key press
- **🚗 Live traffic** — TomTom flow tiles se asli congestion colors (green = chalta hai, red = jam)
- **🔍 Keyless search** — koi bhi jagah ka naam likho, wahan pahuncho. Google key ki zaroorat nahi
- **🌐 Home toggle** — globe ↔ Surat city, ek hi button, kabhi kheton mein nahi phansoge
- **🏙️ 10 Indian cities + landmarks** — Surat, Mumbai, Delhi, Ahmedabad, Bengaluru, Hyderabad, Chennai, Kolkata, Jaipur, Agra — Taj Mahal, India Gate, Charminar ke precise POIs
- **🎙️ Voice-ready** — OpenAI key lagao to globe se baat karo

---

## 📡 Kya LIVE hai (bina kisi key ke)

| Layer | Source | Real? |
|---|---|---|
| ✈️ Flights | OpenSky / adsb.lol (ADS-B) | **100% REAL** |
| 🪖 Military | adsb.lol mil | **100% REAL** |
| 🛰️ Satellites | CelesTrak TLEs (ISS included) | **100% REAL** |
| 🌋 Earthquakes | USGS | **100% REAL** |
| 🚀 Launches | Launch Library 2 | **100% REAL** |
| 📹 CCTV | Austin / California / London official feeds | **100% REAL** |
| 🗺️ Imagery + roads + labels | Esri + OSM | **100% REAL** |
| 📻 Radio | Radio Browser | **100% REAL** |
| 🚗 Traffic | TomTom (key lagao) / simulation (bina key) | **REAL with key** |

Har source ka license + attribution in-app "Data attribution" mein dikhta hai.

---

## 🇮🇳 India features

- **Surat-first boot** — app khulte hi Tapi riverfront pe cinematic entry. Kheton mein nahi phansoge.
- **HOME toggle** — globe se Surat wapas, ek click, guaranteed
- **INDIA CAMS** — mandir trusts aur city agencies ke apne official public broadcasts, app ke andar embed ke saath
- **Hinglish-ready UI path** — poora project Indian developer-friendly comments/structure ke saath

---

## ⚡ Quick Start

```bash
git clone https://github.com/panther742/Third-EYE.git
cd Third-EYE
npm install
npm run dev
```

Browser: **http://localhost:4173** — bas. Pehli baar "LIVE CONTACTS" choose karo, 20 second mein asli planes dikhne lagenge.

Node 24+ recommended (Node 20 pe bhi dev server chalta hai).

---

## 💻 Apne computer pe chalao (Windows/Mac/Linux)

1. **Node.js** install karo (nodejs.org se LTS)
2. Upar wale commands run karo
3. **Optional keys** (sab free):
   - `TOMTOM_API_KEY` — real traffic colors → project root mein `.env` file banao:
     ```
     TOMTOM_API_KEY=apni_key
     ```
   - Cesium ion token — photorealistic 3D buildings → app ke **POWER UP** chip se paste karo
   - AISStream — live ships, FIRMS — live fires, OpenAI — voice

---

## 🔑 Keys (optional)

| Key | Kya deta hai | Kahan se |
|---|---|---|
| TomTom | Live traffic colors | developer.tomtom.com (free, 200K/month) |
| Cesium ion | 3D buildings + world terrain | ion.cesium.com (free tier) |
| AISStream | Live ships | aisstream.io (free) |
| FIRMS | Active fires | firms.modaps.eosdis.nasa.gov (free) |
| OpenAI | Voice control | platform.openai.com (paid) |

App ke andar **⚡ POWER UP** chip se keys paste kar sakte ho — server-side safe rehti hain.

---

## 🧠 Under the hood

- **CesiumJS** globe engine + Vite dev server
- Vanilla JS modules — koi framework ka bhari jhanjhat nahi
- Server-side proxy (dev server ke andar) har sensitive provider ko key ke saath sambhalta hai — browser mein kabhi key expose nahi hoti (Google/ion keys alag, provider-restricted)
- Har data layer alag module: `src/data/` — apna layer add karna ho to ek file + registration, bas
- GLSL-style shader presets visual styles ke liye

---

## 📜 License & credits

Code **MIT** (upstream God's Eye View project se fork kiya gaya — full MIT lineage LICENSE file mein). Third-party data ke apne licenses hain — details `DATA_SOURCES.md` mein. Attribution app ke andar dikhaya jata hai — use kirpa karke on rakho.

**Built on the shoulders of the open-source God's Eye View project — dhanyavaad 🙏 — aur India ke Surat se, dil se.**

---

<div align="center">

### 👁️ Third Eye — *Ab duniya ko dekho apni aankhon se.*

</div>
