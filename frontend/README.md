# Pyometra Outcome Predictor — web app

The clinician-facing front end for the canine pyometra medical-failure risk
model. A vet enters six admission values and gets a printable case-report card:
probability that medical management fails by day 14, a Low / Intermediate / High
band, a driver chart, the observed per-band protocol success rates, a
plain-English read-out, and a non-technical "how it works" explainer.

Stack: **Vite + React + TypeScript + CSS Modules**. No Tailwind, no shadcn, no
CSS-in-JS. The clinical design system lives in `src/styles/tokens.css` (the
single source for colour and type; light/dark handled at the token level). Fonts
are **Fraunces** (display), **Public Sans** (text) and **Spline Sans Mono**
(numeric), loaded from Google Fonts.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

`predev` runs `scripts/sync-model.mjs`, which copies the model's single source of
truth — `../models/final_model.json` — into `src/data/model.json` (git-ignored,
never hand-edited). Regenerate that file from the repo root with:

```bash
python src/analysis/11_finalize_model.py
```

## Component map

`App.tsx` composes:

- `TopBar`
- `CaseForm` (+ `NumberField`) — the six-input admission form
- `ReportCard` (+ `RiskGauge`, `DriverChart`, `ProtocolTable`) — the result card
- `Method` (+ `charts/BarList`, `charts/BandTiles`) — the "how it works" explainer
- `chat/ChatPanel` (+ `ChatMessage`, `ChatComposer`, `hooks/useChat`,
  `lib/geminiClient`) — the optional Gemini chat panel

Prediction maths is in `lib/predict.ts` (a direct mirror of
`src/predict_case.py`); the parsed model data is in `lib/model.ts`. Every
component is a `.tsx` + `.module.css` pair.

## Env

`VITE_PROXY_URL` (optional) enables the Gemini chat by pointing the app at the
serverless proxy in `../proxy/`, which keeps the API key server-side. Copy the
template and fill it in:

```bash
cp .env.example .env
```

Left blank, the chat panel shows a "not configured" note and everything else
works — the predictor is fully deterministic and offline-capable.

## Build

```bash
npm run build                       # -> dist/  (base "/", for Vercel / any root host)
SINGLE_FILE=1 npm run build          # -> one self-contained dist/index.html
PAGES_BASE=/canine-pyometra-ml/ npm run build   # -> dist/ for GitHub Pages project site
```

`base` defaults to `/` (Vercel). `SINGLE_FILE=1` inlines every asset via
`vite-plugin-singlefile` into one `dist/index.html` you can email around, run
from `file://`, or publish as an artifact. `npm run build` runs `prebuild` →
`sync-model` first, so `../models/final_model.json` must be present.

**Hosting is Vercel** — see `../DEPLOY.md`. Set Root Directory = `frontend`;
`vercel.json` pins the build. GitHub Pages is a manual fallback
(`.github/workflows/deploy-pages.yml`, `workflow_dispatch`).

## Parity

```bash
npm run parity
```

`scripts/parity-check.mjs` re-implements the logistic prediction from
`../models/final_model.json`, checks a known HIGH case and a known LOW case land
in the expected bands, and — when Python is available (repo-root `.venv` first,
then `python3`) — shells out to `../src/predict_case.py` for each case and
asserts the browser and Python agree to the whole percent. It prints
`PARITY PASS` / `PARITY FAIL: …` and exits non-zero on any failure.

## Design notes

- `src/styles/tokens.css` is the only place colour and type are defined; nothing
  else hard-codes a hex value or font.
- Every component ships as a `.tsx` + `.module.css` pair — no utility classes,
  no CSS-in-JS.
- Light and dark are resolved by swapping token values, not by per-component
  overrides.
