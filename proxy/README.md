# canine-pyometra Gemini proxy

A tiny serverless proxy that holds the Google Gemini API key **server-side** and
streams chat completions back to the static React app on GitHub Pages.

## Why this exists

**An API key embedded in a static site is public.** GitHub Pages serves only
pre-built files — anything the browser needs, anyone can read. A Gemini key in the
JS bundle (or in a `VITE_` variable baked in at build time) can be extracted in
seconds from the deployed `assets/*.js` and used to spend your quota or run up a
bill against your project.

So the key never goes near the frontend. The browser calls this proxy; the proxy
adds the key and talks to Gemini. The frontend only ever knows the proxy URL.

## Contract

`POST {VITE_PROXY_URL}/chat` with JSON:

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
| `GEMINI_MODEL` | no | `gemini-2.0-flash` | |
| `ALLOWED_ORIGIN` | no | `*` | Lock to the Pages origin in production. |

`.env.example` and `.dev.vars.example` show the shape. **The real `.env` and
`.dev.vars` are gitignored — no API key belongs in this repo.**

## Repo layout

```
proxy/
  shared/
    systemPrompt.js   buildSystemPrompt(caseContext) + MODEL_FACTS
    gemini.js         streamGemini(...) -> ReadableStream<Uint8Array> of text
    handler.js        runtime-agnostic: CORS, routing, validation, wiring
  cloudflare/
    worker.js         export default { fetch(request, env) }
    wrangler.toml
  vercel/
    api/chat.ts       edge function; delegates to shared/handler.js
    README.md
  .env.example
  .dev.vars.example
  package.json         type: module, zero dependencies
```

Zero runtime dependencies — native `fetch`, `ReadableStream`, `TextEncoder`,
`TextDecoder` only. `wrangler` is the only tool you install, and only for
Cloudflare.

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

See [`vercel/README.md`](vercel/README.md) for the step-by-step. In short: deploy
the `proxy/vercel` folder as a project (Root Directory `proxy/vercel`), or copy
`api/chat.ts` **and** `shared/` into an existing project. Set `GEMINI_API_KEY`,
`GEMINI_MODEL`, `ALLOWED_ORIGIN` in **Project -> Settings -> Environment
Variables**.

Endpoint: `https://<project>.vercel.app/api/chat`.

---

## Point the frontend at it

Local dev:

```bash
# frontend/.env
VITE_PROXY_URL=https://<name>.<your-subdomain>.workers.dev
```

GitHub Pages build: add a repository **variable** (Settings -> Secrets and
variables -> Actions -> Variables tab), **not** a secret:

```
VITE_PROXY_URL = https://<name>.<your-subdomain>.workers.dev
```

The Pages workflow passes it to `vite build`, which inlines it. That is fine —
the proxy URL is not sensitive; only the Gemini key is, and that stays on the
proxy.

The frontend appends `/chat`, so set `VITE_PROXY_URL` to the origin **without** a
trailing slash and without `/chat`.

---

## curl smoke test

```bash
URL=https://<name>.<your-subdomain>.workers.dev

curl -N -X POST "$URL/chat" \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Why is this case high risk?"}],"caseContext":{"values":{},"probability":0.9,"band":"High","drivers":[],"modelAuc":0.95,"disclaimer":"x"}}'
```

`-N` disables curl's buffering so you see the text stream in real time. A bad
body returns a one-line JSON `{"error":"…"}`; a Gemini-side failure returns a
single plain-text apology line (never the key or the upstream error).

CORS preflight check:

```bash
curl -i -X OPTIONS "$URL/chat" -H 'origin: https://bhattarya.github.io'
# -> 204, with Access-Control-Allow-Origin / -Methods / -Headers
```

---

## Cost & rate-limiting

`gemini-2.0-flash` is cheap but **not free at scale** — a publicly reachable
endpoint with your key behind it is a spend risk. If you expose this publicly:

- Keep `ALLOWED_ORIGIN` locked to `https://bhattarya.github.io` (this only stops
  browser calls from other origins — it is not a security boundary against
  scripted clients).
- Add a **Cloudflare Rate Limiting rule** on the Worker route (e.g. N requests
  per minute per IP), or a simple per-IP counter in a Workers KV / Durable
  Object, or Cloudflare Turnstile in front of the chat UI.
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
