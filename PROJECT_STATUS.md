# Project status & handoff

_Snapshot for continuing in a new session. Last updated after the dark editorial redesign._

Repo: <https://github.com/bhattarya/canine-pyometra-ml> · local: `~/Documents/GitHub/canine-pyometra-ml`
Live artifact (predictor): <https://claude.ai/code/artifact/5bc1993f-d109-4bca-b2cd-c62382274965>

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
| Finalised deployable model + JSON export | ✅ `11` → `models/final_model.json` |
| Zero-build single-file predictor page | ✅ `site/` (`12`; superseded by `frontend/`, kept as offline fallback) |
| Python CLI predictor (parity reference) | ✅ `src/predict_case.py` |
| **React app** (Vite + React 18 + TS + CSS Modules) | ✅ `frontend/` |
| **Gemini chat** — serverless proxy (Cloudflare + Vercel + local dev server + real test) | ✅ `proxy/` |
| Chat UX: case badge, starter prompts, Clear, light markdown | ✅ |
| **Dark editorial redesign** (ref lance.live) | ✅ `7eccf00` |
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
4. **User actions to go live:**
   - GitHub → Settings → Pages → Source **"GitHub Actions"** → next push deploys
     to `https://bhattarya.github.io/canine-pyometra-ml/`.
   - **Revoke the Gemini key pasted in the last session** (it's in that transcript).
     Generate a fresh one.
   - Deploy the proxy (`proxy/README.md` → Cloudflare) and set repo **variable**
     `VITE_PROXY_URL` to enable the chat on the deployed site.
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
- **Deployed model** (`models/final_model.json`): L2 logistic regression on
  **BUN, creatinine, albumin, ALP, age, illness duration** → ROC-AUC
  **0.948 ± 0.066** (repeated stratified 5-fold CV). Fixed risk bands
  **Low < 10%, Intermediate 10–40%, High > 40%**. Observed failure by band:
  Low 0% (n=40), Intermediate 0% (n=13), **High 52% (n=27)**. Within High:
  G1 12% · G2 17% · **G3 67% · G4 100%**.
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

- **Design system:** `src/styles/tokens.css` — **dark-first editorial**, ref
  lance.live. Pure black ground, warm-grey `#bcbbb4` secondary text,
  translucent-white surfaces, soft radii (18px cards, pill buttons), signature
  `.pill` button with a trailing white circle-arrow. Fonts: **Instrument Serif**
  (display) + **Plus Jakarta Sans** (body/numbers) via Google Fonts. Committed
  **single-theme dark**; the `Method` section renders on warm paper `#f7f6f4` —
  `global.css` `.paper-scope` remaps the palette so children need no per-component
  theming. `tokens.css` also keeps **legacy aliases** (`--ink`, `--rule`, …) so
  any not-yet-restyled module still resolves.
- **Component map:** `App.tsx` → `TopBar`, `CaseForm`(+`NumberField`),
  `ReportCard`(+`RiskGauge`, `DriverChart`, `ProtocolTable`), `ChatPanel`
  (+`ChatMessage`, `ChatComposer`, `hooks/useChat`, `lib/geminiClient`),
  `Method`(+`charts/BarList`, `charts/BandTiles`).
- **Logic:** `lib/predict.ts` mirrors `src/predict_case.py` exactly; `lib/model.ts`
  reads `src/data/model.json`, synced from `models/final_model.json` by
  `scripts/sync-model.mjs` (runs on `predev`/`prebuild`). `hooks/useTheme.ts` is
  now unused (toggle dropped) — safe to delete.
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

## 7. `proxy/` — Gemini chat proxy

Keeps the API key **server-side** (a key must never ship in a static bundle).
Runtime-agnostic core in `shared/` (`handler.js` routing+CORS+validation,
`gemini.js` SSE→plain-text, `systemPrompt.js`), with **Cloudflare Worker**
(`cloudflare/`) and **Vercel edge** (`vercel/`) entrypoints, plus a zero-dep
**local dev server** and a **real end-to-end test** you run with your own key.

```
cd proxy
cp .dev.vars.example .dev.vars     # paste a FRESH GEMINI_API_KEY (git-ignored)
npm run dev                        # http://localhost:8787/chat
GEMINI_API_KEY=xxx npm test        # one real Gemini call, streamed, PASS/FAIL
```

Deploy: `proxy/README.md` (Cloudflare `wrangler deploy` + `wrangler secret put
GEMINI_API_KEY`, or Vercel env vars). Then set repo variable `VITE_PROXY_URL`.
System prompt tells the model the study facts + limits and forbids definitive
treatment directives.

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
