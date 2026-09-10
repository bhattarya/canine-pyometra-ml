# Project status & handoff

_Snapshot for continuing in a new session. Last updated after the app + Gemini
proxy went live on **Vercel** and the AI-generated summary was confirmed working
end-to-end._

Repo: <https://github.com/bhattarya/canine-pyometra-ml> · local: `~/Documents/GitHub/canine-pyometra-ml`
**Live app:** <https://canine-pyometra-ml.vercel.app/> (Vercel project, Root Directory `frontend`, redeploys on push to `main`)
**Live proxy:** <https://canine-pyometra-ml-proxy.vercel.app/api/chat> (separate Vercel project, Root Directory `proxy`)

---

## 1. What this is

Machine-learning models to predict **treatment outcome in canine pyometra** from
admission-day clinical / haematology / biochemistry values + treatment protocol
(G1–G4). For the user's brother (a vet) to present at a conference. Methodology
mirrors the canine-parvovirus prognosis study of **Nafe Monfared et al.,
*Front. Vet. Sci.* 2025** (3-stage feature reduction → multi-algorithm bake-off
under repeated stratified CV) and the workbook's own `ML_Roadmap` sheet.

> The 80-dog dataset is clean, balanced and looks **simulated** (perfect 20/20/20/20
> arms, zero baseline missingness). Everything is framed as a **methodology
> demonstration / hypothesis-generating analysis**, not a validated clinical tool.

---

## 2. Current state — DONE

| Area | Status |
|---|---|
| Data audit, descriptives, longitudinal mixed model | ✅ `src/analysis/01–03` |
| Prognostic ML (G1–G3 → `Medical_Failure_D14`, 3 stages) | ✅ `04` |
| Treatment-outcome ML (G1–G4 + Group → `Treatment_Success_D14`) + G1–G3 sensitivity | ✅ `05` |
| Missing-data comparison, recovery-time regression, risk score | ✅ `06–08` |
| Narrative results report | ✅ `reports/findings.md` (built by `09`) |
| Talk figures | ✅ `results/figures/talk_*.png` (`10`) |
| Prognostic (medical-failure) model + JSON | ✅ `11` → `models/prognostic_model.json` (analysis artefact) |
| **DEPLOYED model: treatment-success by chosen protocol** | ✅ `13_finalize_treatment_model.py` → `models/final_model.json` |
| Python CLI predictor (parity reference) | ✅ `src/predict_case.py` (rewritten for the treatment model) |
| **React app** (Vite + React 18 + TS + CSS Modules) | ✅ `frontend/` |
| **Plain-English summary under the result** — `CaseSummary` + `lib/summary.ts` (deterministic template) is the built-in / fallback. If `VITE_PROXY_URL` is set, `lib/aiSummary.ts` streams a **Gemini-written** summary instead (`proxy/` one-shot `mode:"summary"`). Chat panel removed. | ✅ `8b6ddbb`, AI wiring `feat/ai-summary` |
| ~~Dark editorial redesign (lance.live)~~ → **replaced** by a **light clinical form** matching the user's screenshot | ✅ |
| Old zero-build `site/` single-file page + `12_build_site.py` | ❌ **removed** — schema changed; `frontend/` `SINGLE_FILE=1` build is the offline/one-file deliverable now |
| GitHub Pages deploy workflow (builds `frontend/`) | ✅ `.github/workflows/deploy-pages.yml` |
| Python↔JS parity test | ✅ `cd frontend && npm run parity` → PASS |

---

## 3. Pending — NEXT SESSION

1. **Visual QA the redesign.** Couldn't screenshot it last session (preview pane
   was closed). User to open the artifact and flag: masthead line break, spacing,
   gauge, the warm-paper Method section, mobile. Then one focused fix pass.
2. **PowerPoint slide deck** — not started. ~12–15 slides, CPV-article structure
   (background → methods → results → the predictor → limitations), charts from
   `results/figures/`.
3. **Narrative report** (CPV-article style, Word/PDF) — not started.
   `reports/findings.md` is the raw material; needs Intro/Methods/Results/
   Discussion prose for a non-statistician reader.
4. **Deployment — DONE (both Vercel projects live, AI summary confirmed):**
   - App project: Root Directory `frontend`, live at
     <https://canine-pyometra-ml.vercel.app/>, redeploys on push to `main`.
   - Proxy project: Root Directory `proxy`, endpoint `/api/chat`, env
     `GEMINI_API_KEY` set. Live at
     <https://canine-pyometra-ml-proxy.vercel.app/api/chat>.
   - App env `VITE_PROXY_URL = https://canine-pyometra-ml-proxy.vercel.app`
     (Config type, not Secret — `VITE_*` is inlined into the browser bundle).
   - `0c9957c` fixed the last bug: frontend was posting to `/chat`, the Vercel
     function is at `/api/chat`. Verified live — summary tag reads "AI-GENERATED".
   - **Still to do by the user:** (a) **revoke the Gemini key pasted in chat**,
     generate a fresh one, update `GEMINI_API_KEY` on the proxy project only;
     (b) delete the stray `GEMINI_API_KEY` env var on the **app** project (it does
     nothing there — the key must never be in the frontend).
   - GitHub Pages workflow is now **manual-only** (`workflow_dispatch`).
5. **Housekeeping:** split `notebooks/*.ipynb` into real walkthrough cells (they
   are single-cell mirrors now); move `src/inspect_workbook.py` → `tools/`;
   delete merged remote branches (`feat/ml-pipeline`, `feat/predictor-and-showcase`,
   `feat/react-frontend`, `feat/chat-dev-runner`) via GitHub — CLI delete was
   blocked by a safety rule.
6. **Process note:** the redesign commit `7eccf00` went **directly onto `main`**
   (session was left on `main` after the previous merge). Future changes: branch
   first, `--no-ff` merge.
7. Minor: 2 npm audit warnings in `frontend/` (esbuild/vite dev deps) — low priority.

---

## 4. Key numbers (for the deck / report)

- **Cohort:** 80 dogs, 4 protocols × 20, followed to day 14. Baseline complete,
  balanced across arms (0/19 vars differ, all ANOVA p > 0.05).
- **Protocols:** G1 supportive · G2 PGF2α · G3 aglepristone + PGF2α · G4 OHE.
- **Observed success gradient:** G1 65% → G2 75% → G3 90% → **G4 100%**.
- **Targets:** `Treatment_Success_D14` 66/14 (17.5% failure);
  `Medical_Failure_D14` 14/60 on G1–G3; `Days_to_Resolution` continuous n=74.
  `Death` 1/80 and `Recurrence_6mo` 4/80 → **not modellable**, reported descriptively.
- **G4/OHE is perfectly separated** (20/20 success) → penalised estimators for the
  treatment model + a G1–G3-only sensitivity model. Protocol comparisons are
  descriptive, not causal.
- **Prognostic model:** ROC-AUC ≈ **0.95** across all 3 feature-set stages;
  top algorithms (LogReg-L2, RandomForest, GaussianNB, QDA) within CV noise.
- **Treatment-outcome model:** ROC-AUC ≈ **0.96–0.97**.
- **Dominant predictors everywhere:** BUN, creatinine, ALP, ALT, low albumin.
  Azotaemia flag → 50% vs 3.6% failure.
- **Prognostic model** (`models/prognostic_model.json`, analysis only): L2 logit
  on **BUN, creatinine, albumin, ALP, age, illness duration** → ROC-AUC
  **0.948 ± 0.066**. Bands Low <10 / Int 10–40 / High >40; observed failure
  Low 0% (n40) · Int 0% (n13) · High 52% (n27).
- **DEPLOYED model** (`models/final_model.json`, task `treatment_success`): L2
  logit on **protocol (G1–G4, G1 reference) + 9 admission vars** (age, illness
  duration, heart rate, TLC, creatinine, albumin, ALP, uterine diameter,
  clinical VAS) → P(treatment success by day 14). ROC-AUC **0.894 ± 0.094**
  (repeated stratified 5-fold CV). Group terms vs G1: G2 −0.10, **G3 +0.45,
  G4 +1.16**. Bands: <50% "unlikely", 50–85% "uncertain", >85% "likely".
  **G4/surgery** has zero cohort failures → the tool shows the **observed rate
  (~100%)**, not the model value, with a caveat, and hides the driver chart for it.
- **Model validation** (`14_validate_treatment_model.py`, `results/tables/14_*`):
  15-algorithm bake-off on the exact deployed design.
  - Every reasonable model sits in a **narrow band, ROC-AUC ≈ 0.89–0.95 with
    ±0.06–0.12 SD** — the CV intervals overlap almost entirely; **no algorithm is
    reliably more accurate** on n=80 / 14 failures (**EPV ≈ 1.2**, far below 10).
  - Nominal "best" GaussianNB AUC 0.951 but **Brier 0.388** (broken calibration)
    and raw accuracy 0.58 (< the 0.825 majority baseline) — high ranking, useless
    probabilities. RF / RBF-SVM: AUC ~0.94, Brier ~0.08, but **specificity ~0.5**
    (miss ~half the failures). Deployed logistic: AUC 0.906–0.911, **nested CV
    0.911 ± 0.086 → zero tuning optimism**, Brier ~0.11, best specificity comes
    from L1-LASSO logistic (0.83).
  - **Verdict: keep logistic regression.** Within ~0.04 AUC of the best, honest
    under nested CV, gives odds ratios, and is the only option that runs as ~20
    lines of browser JS. The weak spot is failure detection (small-sample), which
    the UI already handles by leading with the band + observed cohort rates.
- **Recovery regression:** negative R² — admission vars don't predict resolution
  time here (honest null; CPV paper got RMSE ≈ 1.8 d).
- **Retro 240 cases:** Breed / Age / Open-Closed / OHE-Medical only — **no outcome
  column**, so case-mix description only, not prognostic validation.

---

## 5. Repo map

```
data/raw/canine_pyometra_80.xlsx     source dataset (11 sheets)
data/processed/*.csv                  assembled analysis frames (regenerated)
src/pyo/                              package: config · data · pipelines (15-model zoo) · evaluate · experiment
src/analysis/01..12 + run_all.py      the pipeline (see §2)
src/predict_case.py                   CLI predictor — parity reference for the web app
src/inspect_workbook.py               dev helper (TODO: move to tools/)
models/final_model.json               locked deployable model (coef, standardisation, bands, protocol rates, display data)
results/tables/*.csv  results/figures/*.png   outputs (committed)
reports/findings.md                   narrative results
notebooks/*.ipynb                     jupytext mirrors (single-cell; TODO split)
site/template.html + site/index.html  zero-build single-file predictor (offline fallback)
frontend/                             the React app — see §6
proxy/                               serverless Gemini proxy — see §7
.github/workflows/deploy-pages.yml    builds frontend/ -> GitHub Pages
.venv/                               Python 3.14 venv
```

---

## 6. `frontend/` — the React app

Vite + React 18 + **TypeScript** + **CSS Modules** (no Tailwind, no shadcn).

- **Design system:** `src/styles/tokens.css` — **light clinical form** matching
  the user's screenshot. Warm off-white `#f6f4ef` ground, white input fields,
  near-black **Archivo** headings (800 wt), teal CTA `#2f7d7d`, semantic
  green/amber/red for the success probability. Single-theme (light), by design.
  Globals: `.control` (inputs/selects), `.btn-primary` (teal), `.btn-ghost`.
- **Component map:** `App.tsx` → `CaseForm`(protocol `<select>` + `NumberField`
  grid + "Predict treatment success" button), `ReportCard`(+`SuccessGauge` in
  `RiskGauge.tsx`, `DriverChart`, `ProtocolTable`), `CaseSummary`(+`lib/summary.ts`
  deterministic + `lib/aiSummary.ts` Gemini-via-proxy), `Method`.
  Prediction is **button-triggered**, then updates live; result card + summary
  only render after the first submit. Removed: `TopBar`, `hooks/useTheme`,
  `charts/BandTiles`, chat.
- **Method section charts** (`frontend/src/components/charts/`, data curated in
  `frontend/src/data/findings.ts` from `results/tables/14_*`, `05_stage_progression.csv`,
  `models/*.json`): `AlgorithmLeaderboard` (15-algo ROC-AUC bars, LogReg
  highlighted), `StageReduction` (20→11→4 predictors vs AUC, CPV-style),
  `BandCalibration` (observed success per predicted band), `FeatureEffects`
  (diverging standardised coefficients + protocol effects vs G1), plus the two
  existing `BarList` figures. All hand-drawn inline SVG.
- **Logic:** `lib/predict.ts` mirrors `src/predict_case.py`; `predict(values, group)`
  → `{probability, band, observedOnly, drivers[]}`. `lib/model.ts` reads
  `src/data/model.json`, synced from `models/final_model.json` by
  `scripts/sync-model.mjs` on `predev`/`prebuild`. G4 → observed rate, not model.
- **Env:** `VITE_PROXY_URL` (optional) enables the chat. `.env.development`
  defaults it to `http://localhost:8787` for local dev; unset in production unless
  the repo variable is set.

Commands (from `frontend/`):
```
npm install
npm run dev                    # predev hook syncs the model JSON
npm run build                  # -> dist/ for Pages (base /canine-pyometra-ml/)
SINGLE_FILE=1 PAGES_BASE=/ npm run build   # -> one self-contained dist/index.html (artifact)
npm run parity                 # asserts JS === Python predictions
```

---

## 7. `proxy/` — Gemini AI-summary proxy

Keeps the API key **server-side**. `shared/` holds the runtime-agnostic core:
`handler.js` (routing + CORS + validation + `mode:"summary"` one-shot),
`gemini.js` (SSE→plain-text — **CRLF-normalised**, `thinkingBudget:0`,
`maxOutputTokens:1400`), `systemPrompt.js` (`buildSummaryPrompt` — strict,
grounded, no invented numbers, no treatment directives). Entrypoints:
`proxy/api/chat.ts` (**Vercel**, Root Directory = `proxy`, endpoint
`/api/chat`), `cloudflare/worker.js` (Cloudflare). `dev-server.mjs` + `test.mjs`
for local. Default model **`gemini-flash-latest`** (`gemini-2.0-flash` is
retired). Verified end-to-end against the live API.

```
cd proxy
cp .dev.vars.example .dev.vars     # paste a FRESH GEMINI_API_KEY (git-ignored)
npm run dev                        # http://localhost:8787/chat
GEMINI_API_KEY=xxx npm test        # real summary-mode call, streamed, PASS/FAIL
```

Deploy: `DEPLOY.md` §2 (Vercel: import repo, Root Directory `proxy`, set
`GEMINI_API_KEY` + `ALLOWED_ORIGIN`; then set `VITE_PROXY_URL` on the app
project). No AI without this — the app falls back to the deterministic summary.

---

## 8. Environment & gotchas

- **Python 3.14** venv at `.venv` (Homebrew). **Node 25**. `xgboost` needs
  `brew install libomp` — already done on this machine.
- **Workbook parsing:** every sheet has a title row + a blank row *above* the real
  header; column names carry mojibake (`TLCუuL` → `TLC_per_uL`, `µ`→`u`).
  Handled by `src/pyo/data.py:load_sheet` — do not "fix" the raw xlsx.
- `from pyo import config as C` **collides with patsy's `C()`** in formula strings
  — the mixed-model script (`03`) imports it as `CFG`.
- **QDA** fails when a class has fewer samples than features; `evaluate.py` wraps
  each fold fit in try/except and records `FAILED` rather than crashing.
- `results/*.log` are git-ignored; `models/final_model.json` **is** committed
  (CI's `prebuild` sync needs it); `frontend/src/data/model.json`,
  `frontend/dist/`, `node_modules/`, `.env`, `.dev.vars` are git-ignored.

---

## 9. Git

`main` history is a chain of `--no-ff` merges:
`a128f99` initial → `6a659dc` ml-pipeline → `2da0830` predictor-and-showcase →
`2f74240` react-frontend → `630234f` chat-dev-runner → `7eccf00` redesign
(direct commit — see §3.6).

Merged feature branches still exist on `origin` (harmless): `feat/ml-pipeline`,
`feat/predictor-and-showcase`, `feat/react-frontend`, `feat/chat-dev-runner`.

Commit trailer in use:
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
