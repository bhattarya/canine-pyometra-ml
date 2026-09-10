# Deploying

Two independent deployments: the **web app** (`frontend/`) and, optionally, the
**Gemini chat proxy** (`proxy/`). The app works fully without the proxy — the
chat panel just shows a "not configured" note.

---

## 1. Web app → Vercel  (primary)

The app is a static Vite build in a subdirectory, so Vercel needs the **Root
Directory** pointed at `frontend/`.

**One-time setup**

1. <https://vercel.com/new> → import `bhattarya/canine-pyometra-ml`.
2. **Root Directory:** `frontend`  (click *Edit*, select the folder).
3. Framework preset: **Vite** (auto-detected). Build/output are already pinned in
   `frontend/vercel.json` (`npm run build` → `dist/`).
4. *(optional)* **Environment Variables** → add `VITE_PROXY_URL` =
   `https://<your-proxy>` to enable the chat. It is read at build time, so
   redeploy after changing it.
5. **Deploy.** Every push to `main` redeploys; PRs get preview URLs.

Notes

- `npm run build` runs a `prebuild` hook that copies
  `../models/final_model.json` into the bundle. Vercel checks out the whole repo,
  so the relative path resolves even with Root Directory = `frontend`. Keep
  `models/final_model.json` committed (it is).
- `base` defaults to `/` (correct for Vercel). No `PAGES_BASE` needed.
- No secrets in this deployment — it is pure static files.

---

## 2. Chat proxy → Vercel  (optional, separate project)

Keeps the Gemini API key server-side. See `proxy/README.md` for the full guide;
the short version for Vercel:

1. <https://vercel.com/new> → same repo → **Root Directory:** `proxy/vercel`.
2. **Environment Variables:**
   - `GEMINI_API_KEY` = your fresh key  *(never commit it; rotate the one pasted
     in an earlier chat)*
   - `GEMINI_MODEL` = `gemini-2.0-flash`
   - `ALLOWED_ORIGIN` = your app's Vercel URL (e.g. `https://<app>.vercel.app`)
3. Deploy. The endpoint is `https://<proxy>.vercel.app/api/chat`.
4. Back in the **app** project, set `VITE_PROXY_URL` = `https://<proxy>.vercel.app`
   and redeploy.

`curl` smoke test:

```bash
curl -N -X POST "$PROXY/api/chat" -H 'content-type: application/json' -d '{
  "messages":[{"role":"user","content":"Why is this case likely to succeed?"}],
  "caseContext":{"group":"G3_Aglepristone_PGF2a","groupLabel":"G3","values":{},
    "probability":0.9,"band":"Likely","observedOnly":false,"drivers":[],
    "modelAuc":0.89,"disclaimer":"x"}
}'
```

Cloudflare Workers is also supported (`proxy/cloudflare/`, `proxy/README.md`) if
you prefer it.

---

## 3. GitHub Pages  (manual fallback only)

`.github/workflows/deploy-pages.yml` is set to `workflow_dispatch` only — trigger
it from the **Actions** tab if you want a Pages copy at
`https://bhattarya.github.io/canine-pyometra-ml/`. It builds with
`PAGES_BASE=/canine-pyometra-ml/`. Requires Settings → Pages → Source =
"GitHub Actions".

---

## Local one-file build

```bash
cd frontend
SINGLE_FILE=1 PAGES_BASE=/ npm run build   # -> dist/index.html, fully self-contained
```
