# 🌿 KrishiSathi — कृषि साथी

**A voice-first, offline-ready AI companion for smallholder farmers.**

KrishiSathi is built for a farmer who may not read well, whose phone drops to
2G in the field, and for whom a wrong answer costs a season. Every design
decision follows from those three facts.

| | |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind, installable PWA |
| **Backend** | Firebase Cloud Functions (Node 20, TypeScript) |
| **AI** | Google Gemini — chat, leaf-disease vision, label reading, planning |
| **Data** | OpenWeather (weather + forecast), data.gov.in Agmarknet (mandi prices) |
| **Platform** | Firebase Hosting · Auth · Firestore |
| **Languages** | English, हिन्दी, मराठी, ਪੰਜਾਬੀ, தமிழ், বাংলা |

---

## Team

| Name | ID |
|---|---|
| Vardaan Sharma | 1016A |
| Ved Vishal | 1016B |
| Aditi Sharda | 1016C |
| Bhavik Katal | 1016D |
| Himank | 1016E |

Built for SFHS C.O.D.E Hack 7.0, 2026 — theme: AI for Good / AI for Sustainable Agriculture.

---

## AI usage disclosure

In line with the hackathon's AI usage policy, here is what was used, for what, and how much:

| Tool | Used for | Extent |
|---|---|---|
| **Claude Code** | Primary coding agent — feature implementation (frontend screens, Firebase Functions backend, i18n bundles), debugging, refactors, this README, the AI-usage disclosure and team sections, and the pitch presentation (`KrishiSathi_Pitch.pptx`, including real in-app screenshots and design). | Extensive — main development and documentation tool used throughout the build. |
| **Antigravity** (its AI model) | Secondary debugging assistant for specific issues during development. | Targeted — debugging support only. |

All architectural decisions, product/UX choices (the traffic-light system, voice-first navigation, rule-based scheme eligibility instead of LLM output, offline-first design), and final review of generated code were made by the team.

---

## What it does

### Voice-first navigation
A **hold-to-speak microphone is docked in the bottom bar of every screen**.
Speak in any of the six languages and the app either jumps to the right screen
or hands the question to the AI assistant. Intent routing is keyword-based and
runs entirely on-device, so it works instantly and without network. Every block
of text longer than a line has a 🔊 read-aloud button, and the one message that
changes a farmer's day — the irrigation call — plays automatically on open.

### Traffic-light system
One visual language across the whole app, and colour is never the only cue —
each state also carries a distinct shape (● ▲ ■) and a text label, because
colour-blindness and direct sunlight are both real field conditions.

| | Meaning |
|---|---|
| 🟢 **GREEN** | Verified authentic · normal mandi operations · crop healthy |
| 🟡 **YELLOW** | Caution — long wait times · product under review · watch this crop |
| 🔴 **RED** | Counterfeit confirmed · mandi congested, divert now · crop at risk |

### Screens
- **Home** — live weather, 5-day forecast, smart irrigation alert (with litres
  saved), quick actions, today's plan, sustainability score
- **Crops** — per-crop stage, health signal, next action, yield forecast
- **AI Bot** — Gemini agronomist with voice in and voice out, full transcript
  cached offline
- **Mandi** — live prices, yard congestion + wait times, best-price finder,
  profit calculator
- **Tools** — 10 tools: disease scan, counterfeit check, yield, schemes, soil,
  rotation, land diversification, expenses, organic advisor, emergency SOS
- **Profile** — farm details, GPS, language, voice settings, live-service status

### The differentiators
- **Counterfeit verification** — scan a barcode (native `BarcodeDetector`, ZXing
  fallback) or photograph the label. GS1 check-digit validation runs on-device
  and works offline; Gemini reads the label for brand and registration number
  when online. It only ever returns GREEN on positive evidence and defaults to
  YELLOW when it cannot confirm — an honest "unverified" beats a confident
  wrong answer on a product a farmer is about to spray.
- **Land diversification** — turns idle acreage into four costed options
  (agroforestry, apiary, solar lease, mushroom) with investment, monthly income,
  payback period and concrete first steps.
- **Government schemes** — eligibility is decided by **hand-written rules, not
  the LLM**. Scheme names, benefit amounts and portal URLs are facts a farmer
  will act on; a hallucinated ₹ figure is worse than no answer. Gemini only
  translates the explanation.
- **Offline-first** — IndexedDB cache with stale-while-offline fallback, a
  service worker for the app shell, an outbox that replays actions written while
  offline, and an on-device rule base so the assistant still answers common
  questions in a dead zone.

---

## Running it

```bash
# Frontend
cd web && npm install && npm run dev          # → http://localhost:5173

# Backend (separate terminal)
cd functions && npm install && npm run build
firebase emulators:start --only functions      # → http://localhost:5001
```

The app is **fully usable with no keys at all** — it falls back to realistic
cached data and clearly labels it as such on the Profile screen. Add keys to go
live.

### API keys

```bash
cp functions/.env.example functions/.env
```

| Variable | Where to get it | Powers |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Chat, disease vision, label reading, diversification |
| `OPENWEATHER_API_KEY` | [openweathermap.org/api_keys](https://home.openweathermap.org/api_keys) | Weather, forecast, irrigation alert, geocoding |
| `DATA_GOV_API_KEY` | [data.gov.in/apis](https://data.gov.in/apis) *(optional)* | Live Agmarknet mandi prices |

Keys live only on the backend — `functions/.env` is gitignored and the browser
never sees them. For production use Firebase secrets:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set OPENWEATHER_API_KEY
```

The Firebase **web** config in `web/src/lib/firebase.ts` is public by design: it
identifies the project, it does not grant access. Firestore rules do that.

### Deploy

```bash
cd web && npm run build
firebase deploy          # hosting + functions + firestore rules
```

Hosting rewrites `/api/**` to the `api` function, so the frontend needs no
absolute backend URL.

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Which live services are configured |
| `GET /api/weather?lat&lon&lang` | Current + 5-day forecast + irrigation verdict |
| `GET /api/mandi?state&commodities` | Agmarknet prices with congestion signal |
| `GET /api/soil?lat&lon` | Modelled NPK / pH with fertiliser advice |
| `POST /api/ai/chat` | Agronomist chat, farm context aware |
| `POST /api/ai/diagnose` | Leaf photo → disease, severity, treatment |
| `POST /api/ai/verify` | Barcode / label → authenticity verdict |
| `POST /api/ai/diversify` | Idle land → costed income options |
| `POST /api/ai/schemes` | Rule-matched scheme eligibility |

Endpoints return **503** when a key is missing, which the client treats as
"show cached data" rather than an error.

---

## Notes on accuracy

Two deliberate choices worth calling out, because they trade capability for
trustworthiness:

- **Soil readings are modelled, not measured.** India has no free public
  point-API for the Soil Health Card database, so `functions/src/soil.ts`
  derives a deterministic profile from agro-ecological zone characteristics.
  The UI says so and links to the free government soil test. Swap the function
  body for a real lab feed and nothing else changes.
- **Mandi congestion is inferred from price spread.** The open Agmarknet dataset
  carries no arrival-volume column on every row, so a wide min–max band at a
  yard stands in for heavy mixed arrivals. Wire in stored history for a true
  day-on-day delta.
- **Live Agmarknet prices need a data.gov.in key, and that registration is not
  instant.** Unlike most open-data signups, data.gov.in requires identity
  verification (Aadhaar / PAN / Driving License via Jan Parichay), not just an
  email or mobile OTP. Budget real time for it, or don't — `DATA_GOV_API_KEY`
  is optional and its absence is a supported first-class state: the backend
  returns 503 and the client falls back to curated mandi data automatically.

The Gemini prompts enforce agronomic safety rules: never recommend a pesticide
banned in India, always state protective equipment and the pre-harvest interval,
and defer to 1800-180-1551 / 108 for anything involving human or animal harm.

---

## Project layout

```
web/                    React PWA
  src/lib/              firebase, api, cache, speech, barcode, image, intents
  src/i18n/             six language bundles
  src/components/       AppShell, VoiceMic, Sheet, StatusLight, ui primitives
  src/screens/          six main screens + eight tool screens
functions/              Firebase Cloud Functions
  src/gemini.ts         REST client + the shared farmer persona prompt
  src/weather.ts        OpenWeather + irrigation decision logic
  src/mandi.ts          Agmarknet + congestion inference
  src/schemes.ts        rule-based eligibility catalogue
  src/soil.ts           modelled soil profile
```

## Roadmap

- React Native client (the `web/src/lib` layer is the shared seam — swap
  `cache.ts` for expo-sqlite and `barcode.ts` for a native ZBar binding)
- Whisper ASR + IndicTTS for dialects the Web Speech API does not cover
- ChromaDB vector store for scheme documents, replacing the rule catalogue with
  true RAG over the source PDFs
- Farmer-reported counterfeit registry (the Firestore rules already model it as
  write-only)
