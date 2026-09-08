# Vercel deploy target

This folder is a thin Vercel wrapper around the shared proxy logic in
[`../shared`](../shared). The actual request handling, CORS, validation, and
Gemini streaming live there and are identical to the Cloudflare Worker.

## Option A — deploy this folder as its own Vercel project

1. Push the repo (this branch) to GitHub.
2. In Vercel: **New Project** -> import the repo.
3. Set **Root Directory** to `proxy/vercel`.
   - Leave the framework preset as **Other**. No build command, no install step
     is required — the edge bundler compiles `api/chat.ts` and follows the
     relative `import` into `proxy/shared/*.js` (those files are part of the same
     git checkout, so they are always available at build time).
4. **Settings -> Environment Variables** — add:
   | Name | Value |
   | --- | --- |
   | `GEMINI_API_KEY` | your key (mark it as a Secret; never commit it) |
   | `GEMINI_MODEL` | `gemini-2.0-flash` |
   | `ALLOWED_ORIGIN` | `https://bhattarya.github.io` |
5. Deploy. Your endpoint is `https://<project>.vercel.app/api/chat`.

## Option B — copy into an existing Vercel project

Copy **both**:

- `proxy/vercel/api/chat.ts`  ->  `<project>/api/chat.ts`
- `proxy/shared/`             ->  `<project>/api/_shared/` (or anywhere in the project)

Then fix the import at the top of `chat.ts` to point at wherever you put the
shared folder, e.g. `import { handleRequest } from "./_shared/handler.js";`.

Add the same three environment variables as above.

## Notes

- `runtime: "edge"` is required — the handler streams a `ReadableStream` and uses
  the abort signal, which the Node serverless runtime does not support the same way.
- The response is `text/plain; charset=utf-8`, streamed. There is no SSE framing;
  the client just reads text chunks.
- The endpoint only answers `POST` on a path ending in `/chat` (so `/api/chat`
  works). `OPTIONS` returns `204` with CORS headers. Anything else is `404`/`405`.
