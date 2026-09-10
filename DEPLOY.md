# Deploying

Two independent deployments, both on **Vercel**:

1. the **web app** (`frontend/`) — the static Vite build; the only one you need.
2. the **AI‑summary proxy** (`proxy/`) — optional. Holds the Gemini API key
   server‑side and writes the "Plain‑English summary".

The app works fully without the proxy: the summary is then produced by a built‑in
template instead of Gemini.

**No secrets in git.** The Gemini key lives **only** in the proxy Vercel
project's environment variables. `frontend/` ships zero secrets — everything it
needs is public. `.env` / `.dev.vars` are gitignored; keep them that way.

---

## §1 App → Vercel  (primary — do this)

1. Go to <https://vercel.com/new> and import the repo `bhattarya/canine-pyometra-ml`.
2. **Root Directory** → set to `frontend` (click *Edit*, pick the folder).
3. **Framework Preset** → `Vite` (auto‑detected). Leave Build & Output alone —
   they are pinned in `frontend/vercel.json` (`npm ci` → `npm run build` →
   `dist/`).
4. Click **Deploy**. You get a URL like
   `https://canine-pyometra-ml.vercel.app`. Every push to `main` auto‑redeploys;
   pull requests get preview URLs.
5. **Verify:** open the URL → click **Fill example values** → click **Predict
   treatment success** → a result card plus a template **Plain‑English summary**
   appear.

Notes

- No environment variables, no secrets. `base` defaults to `/`, which is correct
  for Vercel (no `PAGES_BASE`).
- The build runs a `prebuild` hook (`sync-model.mjs`) that copies
  `../models/final_model.json` into the bundle. Vercel checks out the **whole
  repo**, so `../models` resolves even though Root Directory is `frontend`. Keep
  `models/final_model.json` committed (it is).
- No client‑side router, so no SPA rewrite is needed or wanted — `index.html` is
  served at `/`.

---

## §2 AI‑summary proxy → Vercel  (optional — separate project)

Deploy this and set `VITE_PROXY_URL` (step 6) and the "Plain‑English summary" is
written by **Gemini** and streamed in live, instead of the built‑in template.

1. Get a **fresh** Gemini API key at <https://aistudio.google.com/apikey>.
   Rotate/replace any key you have ever pasted into a chat.
2. Go to <https://vercel.com/new> → import the **same repo** →
   **Root Directory** → set to `proxy`.
3. On **this** project, add **Environment Variables**:
   | Name | Value |
   | --- | --- |
   | `GEMINI_API_KEY` | the fresh key from step 1 |
   | `ALLOWED_ORIGIN` | the app URL from §1, e.g. `https://canine-pyometra-ml.vercel.app` |
   | `GEMINI_MODEL` | *(optional)* leave unset for the default `gemini-flash-latest` |
4. Click **Deploy**. The endpoint is
   `https://<proxy>.vercel.app/api/chat`.
5. **Verify** with the curl smoke test below — you should see text stream back.
6. Go back to the **APP** project → **Settings → Environment Variables** → add
   `VITE_PROXY_URL` = `https://<proxy>.vercel.app` (the origin only — **no
   trailing slash, no `/chat`**) → **Redeploy** the app (it is read at build
   time).
7. **Verify:** reload the app and run a prediction — the summary now shows
   "AI‑generated · writing…" and streams in.

### curl smoke test (summary mode — note the `/api/chat` path)

```bash
curl -N -X POST "https://<proxy>.vercel.app/api/chat" -H 'content-type: application/json' -d '{
  "mode":"summary",
  "caseContext":{"groupLabel":"G3 - aglepristone + cloprostenol","probability":0.9,"band":"Likely",
    "observedOnly":false,
    "values":{"Serum creatinine":{"value":1.0,"unit":"mg/dL","flag":null},
              "Serum albumin":{"value":2.7,"unit":"g/dL","flag":null}},
    "drivers":[{"label":"Alkaline phosphatase","effect":"supports"}],
    "protocolObserved":{"G3_Aglepristone_PGF2a":{"n":20,"success_rate":0.9}},
    "modelAuc":0.894}
}'
```

### CORS preflight check

```bash
curl -i -X OPTIONS "https://<proxy>.vercel.app/api/chat" \
  -H 'origin: https://canine-pyometra-ml.vercel.app'
# -> HTTP/2 204, with Access-Control-Allow-Origin (ACAO) echoing the app origin
```

Cloudflare Workers is also supported as an alternative host for the proxy — see
`proxy/README.md`.

---

## §3 GitHub Pages  (manual fallback only)

`.github/workflows/deploy-pages.yml` is `workflow_dispatch` only — Vercel is
primary, and this is not wired to push. Trigger it from the **Actions** tab if
you want a Pages copy at
`https://bhattarya.github.io/canine-pyometra-ml/`. It builds `frontend/` with
`PAGES_BASE=/canine-pyometra-ml/` and needs Settings → Pages → Source =
"GitHub Actions". Set the repo **variable** `VITE_PROXY_URL` (Actions →
Variables, not a secret) if you want the AI summary there too.

---

## §4 Local one‑file build

```bash
cd frontend
SINGLE_FILE=1 PAGES_BASE=/ npm run build   # -> dist/index.html, fully self-contained
```
