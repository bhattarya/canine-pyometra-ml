# canine-pyometra Gemini proxy

A tiny serverless proxy that holds the Google Gemini API key **server-side** and
streams the "Plain-English summary" back to the static Vite app on Vercel.

## Why this exists

**An API key embedded in a static site is public.** Vercel (like GitHub Pages)
serves only pre-built files — anything the browser needs, anyone can read. A
Gemini key in the JS bundle (or in a `VITE_` variable baked in at build time) can
be extracted in seconds from the deployed `assets/*.js` and used to spend your
quota or run up a bill against your project.

So the key never goes near the frontend. The browser calls this proxy; the proxy
adds the key and talks to Gemini. The frontend only ever knows the proxy URL.

The app sends **one shot** per prediction (`mode: "summary"`) and renders the
streamed text as the summary card — there is no interactive chat panel.

## Contract

`POST` to any path ending in `/chat` — on Vercel that is
`{VITE_PROXY_URL}/api/chat`, on Cloudflare `{VITE_PROXY_URL}/chat`. The frontend
appends `/chat`; on Vercel the `api/` folder adds the `/api` prefix, and the
handler matches "any path ending in `/chat`", so both work.

**Summary mode** — what the app actually sends, one shot per prediction:

```json
{
  "mode": "summary",
  "caseContext": {
    "groupLabel": "G3 - aglepristone + cloprostenol",
    "probability": 0.9,
    "band": "Likely",
    "observedOnly": false,
    "values": { "Serum creatinine": { "value": 1.0, "unit": "mg/dL", "flag": null } },
    "drivers": [{ "label": "Alkaline phosphatase", "effect": "supports" }],
    "protocolObserved": { "G3_Aglepristone_PGF2a": { "n": 20, "success_rate": 0.9 } },
    "modelAuc": 0.894
  }
}
```

**Chat mode (legacy)** — a message list instead of `mode`:

```json
{
  "messages": [{ "role": "user" | "assistant", "content": "string" }],
  "caseContext": {
    "values": { "BUN_mg_dL": 33, "Creatinine_mg_dL": 1.5, "Albumin_g_dL": 2.2, "ALP_U_L": 430, "Age_years": 8.5, "Illness_Duration_days": 9 },
    "probability": 0.98,
    "band": "High",
    "drivers": [{ "label": "Albumin", "direction": "raises" }],
    "modelAuc": 0.948,
    "disclaimer": "…"
  }
}
```

`caseContext` with a numeric `probability` is required in both modes.

Response: a **plain text stream** — `Content-Type: text/plain; charset=utf-8`,
chunked, the assistant's answer streamed token-by-token as it arrives from
Gemini. No SSE framing on our side, just raw text chunks.

- `OPTIONS` -> `204` + CORS headers.
- Any path ending in `/chat`, method `POST` -> handled. Other methods -> `405`.
  Other paths -> `404`.
- Bad input -> `400` with a short JSON body `{ "error": "…" }` (the only
  non-streamed response).

### Validation rules

- `messages`: non-empty array, at most 40 entries, each `{ role, content }` with
  `role` in `{ user, assistant }` and `content` a string of at most 4000 chars.
- `caseContext`: present, with a numeric `probability`.

## Environment variables

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | yes | — | Never committed. Set as a secret. |
| `GEMINI_MODEL` | no | `gemini-flash-latest` | |
| `ALLOWED_ORIGIN` | no | `*` | Lock to the app's Vercel origin in production. |

`.env.example` and `.dev.vars.example` show the shape. **The real `.env` and
`.dev.vars` are gitignored — no API key belongs in this repo.**

## Repo layout

```
proxy/                 <- Vercel project Root Directory
  api/
    chat.ts           edge function; imports ../shared/handler.js (sibling — always bundled)
  shared/
    systemPrompt.js   buildSummaryPrompt / buildSystemPrompt(caseContext) + MODEL_FACTS
    gemini.js         streamGemini(...) -> ReadableStream<Uint8Array> of text
    handler.js        runtime-agnostic: CORS, routing, validation, wiring
  cloudflare/
    worker.js         export default { fetch(request, env) }
    wrangler.toml
  vercel.json         minimal marker; Vercel auto-detects api/chat.ts
  dev-server.mjs      plain Node http server wrapping shared/handler.js
  test.mjs            one-shot real Gemini call -> streamed answer + PASS/FAIL
  .env.example
  .dev.vars.example
  package.json         type: module, zero dependencies
```

`api/` is a sibling of `shared/`, both inside the project root, so the edge
bundler always follows `../shared/handler.js` into the function. (The old
`proxy/vercel/` layout put `shared/` *outside* a `proxy/vercel` root, which broke
at runtime with module-not-found — that folder is gone.)

Zero runtime dependencies — native `fetch`, `ReadableStream`, `TextEncoder`,
`TextDecoder` only. `wrangler` is optional (Cloudflare deploy only); the local
dev server and test need nothing but Node 20+.

## Run it locally (no wrangler)

```bash
cd proxy
cp .dev.vars.example .dev.vars      # then paste YOUR OWN fresh key into .dev.vars
npm run dev                         # -> http://localhost:8787/chat
```

`.dev.vars` is git-ignored. In another terminal, `cd frontend && npm run dev` —
`frontend/.env.development` already points `VITE_PROXY_URL` at
`http://localhost:8787`, so the live AI summary is wired up.

One-shot end-to-end check against the real API (you run it, with your key):

```bash
cd proxy
GEMINI_API_KEY=your_fresh_key npm test     # or: node test.mjs  (reads .dev.vars)
```

It sends a real high-risk case, streams Gemini's answer to your terminal, and
prints `PASS` / `FAIL`.

---

## Deploy option 1 — Cloudflare Workers (recommended)

Generous free tier (100k requests/day), fast cold starts, first-class streaming.

```bash
npm i -g wrangler
cd proxy

# 1. Edit cloudflare/wrangler.toml:
#      - `name`            -> whatever you want the subdomain to be
#      - [vars] ALLOWED_ORIGIN -> https://bhattarya.github.io
#    (GEMINI_MODEL can stay as-is.)

# 2. Deploy the worker.
wrangler deploy cloudflare/worker.js
#    (or: npm run deploy:cf)

# 3. Store the key as an encrypted secret — paste it at the prompt.
#    NEVER put it in wrangler.toml or any committed file.
wrangler secret put GEMINI_API_KEY
```

Your endpoint is:

```
https://<name>.<your-subdomain>.workers.dev/chat
```

### Local development (Cloudflare)

```bash
cd proxy
cp .dev.vars.example .dev.vars      # then put your real key in .dev.vars (gitignored)
wrangler dev cloudflare/worker.js   # or: npm run dev:cf
```

`wrangler dev` reads `.dev.vars` for `GEMINI_API_KEY` etc. and serves on
`http://localhost:8787` — so the local endpoint is `http://localhost:8787/chat`.

> `wrangler` auto-discovers `cloudflare/wrangler.toml` when you pass
> `cloudflare/worker.js`. If your wrangler version does not, add
> `--config cloudflare/wrangler.toml` to the commands.

---

## Deploy option 2 — Vercel

This is the primary host for the app; the proxy rides along as a second Vercel
project. Full non-developer checklist in [`../DEPLOY.md`](../DEPLOY.md) §2.

1. <https://vercel.com/new> → import the repo → **Root Directory** → `proxy`
   (**not** `proxy/vercel` — that folder no longer exists, and choosing it would
   leave `shared/` outside the root and break the function at runtime).
2. Framework preset: **Other**. No build command, no install step — the edge
   bundler compiles `api/chat.ts` and follows `import "../shared/handler.js"`
   into the sibling `shared/` folder (same git checkout, always present).
3. **Settings → Environment Variables:**
   | Name | Value |
   | --- | --- |
   | `GEMINI_API_KEY` | your key (mark it Secret; never commit it) |
   | `ALLOWED_ORIGIN` | the app's Vercel URL, e.g. `https://canine-pyometra-ml.vercel.app` |
   | `GEMINI_MODEL` | *(optional)* leave unset for the default `gemini-flash-latest` |
4. Deploy.

Endpoint: `https://<project>.vercel.app/api/chat`.

`runtime: "edge"` is declared in `api/chat.ts` via `export const config` and is
required — the handler streams a `ReadableStream` and threads the abort signal
through. The response is streamed `text/plain; charset=utf-8`, no SSE framing.
`OPTIONS` → `204` + CORS; non-`POST` → `405`; other paths → `404`.

To fold this into an **existing** Vercel project instead, copy `api/chat.ts` and
`shared/` into it (keeping `chat.ts` a sibling folder of `shared/`, or fix the
relative import to match) and add the same env vars.

---

## Point the frontend at it

Local dev:

```bash
# frontend/.env
VITE_PROXY_URL=https://<name>.<your-subdomain>.workers.dev
```

Vercel app build (primary): on the **app** Vercel project → Settings →
Environment Variables → add `VITE_PROXY_URL` = the proxy origin, then redeploy.
GitHub Pages fallback build: add a repository **variable** (Settings → Secrets
and variables → Actions → Variables tab), **not** a secret, with the same value.

Either way `vite build` inlines it. That is fine — the proxy URL is not
sensitive; only the Gemini key is, and that stays on the proxy.

The frontend appends `/chat` (which Vercel serves at `/api/chat`), so set
`VITE_PROXY_URL` to the origin **without** a trailing slash and without a path.

---

## curl smoke test

```bash
# Vercel:     PATH=/api/chat     Cloudflare: PATH=/chat
URL=https://<proxy>.vercel.app
PATH_=/api/chat

curl -N -X POST "$URL$PATH_" \
  -H 'content-type: application/json' \
  -d '{"mode":"summary","caseContext":{"groupLabel":"G3 - aglepristone + cloprostenol","probability":0.9,"band":"Likely","observedOnly":false,"values":{"Serum creatinine":{"value":1.0,"unit":"mg/dL","flag":null}},"drivers":[{"label":"Alkaline phosphatase","effect":"supports"}],"protocolObserved":{"G3_Aglepristone_PGF2a":{"n":20,"success_rate":0.9}},"modelAuc":0.894}}'
```

`-N` disables curl's buffering so you see the text stream in real time. A bad
body returns a one-line JSON `{"error":"…"}`; a Gemini-side failure returns a
single plain-text apology line (never the key or the upstream error).

CORS preflight check:

```bash
curl -i -X OPTIONS "$URL$PATH_" -H 'origin: https://canine-pyometra-ml.vercel.app'
# -> 204, with Access-Control-Allow-Origin / -Methods / -Headers
```

---

## Cost & rate-limiting

`gemini-flash-latest` is cheap but **not free at scale** — a publicly reachable
endpoint with your key behind it is a spend risk. If you expose this publicly:

- Keep `ALLOWED_ORIGIN` locked to `https://bhattarya.github.io` (this only stops
  browser calls from other origins — it is not a security boundary against
  scripted clients).
- Add a **Cloudflare Rate Limiting rule** on the Worker route (e.g. N requests
  per minute per IP), or a simple per-IP counter in a Workers KV / Durable
  Object, or Cloudflare Turnstile in front of the app.
- On Vercel, put the function behind Vercel's WAF / rate-limit rules or a KV
  counter.
- Cap `maxOutputTokens` (already set to 700) and consider lowering it.
- Watch usage in Google AI Studio / Cloud console and set a billing budget alert.

---

## Security notes

- **No API key belongs in this repo.** `.env` and `.dev.vars` are gitignored;
  only the `*.example` files are committed.
- The key is passed to `shared/gemini.js` as a function argument; the runtimes
  read it from env and pass it in. It is never logged, echoed, or written into a
  response — Gemini errors are swallowed and replaced with a generic apology.
- The client's abort signal is threaded through to the upstream Gemini `fetch`,
  so pressing "stop" in the UI actually cancels the Gemini call.
