// Local dev server for the Gemini proxy — zero dependencies, Node 20+.
//
//   cd proxy
//   cp .dev.vars.example .dev.vars      # then paste your OWN fresh key into it
//   npm run dev                          # -> http://localhost:8787/chat
//
// .dev.vars is git-ignored. Never commit a key. This wraps the exact same
// shared/handler.js the Cloudflare Worker and Vercel function use, so what you
// test locally is what you deploy.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./shared/handler.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;

// ---- load .dev.vars (KEY=VALUE lines) into process.env, without overriding real env
try {
  const raw = readFileSync(resolve(HERE, ".dev.vars"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  console.log("loaded proxy/.dev.vars");
} catch {
  console.log("no proxy/.dev.vars found — reading GEMINI_API_KEY from the environment");
}

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "\n  GEMINI_API_KEY is not set.\n" +
      "  Put it in proxy/.dev.vars (copy .dev.vars.example) or export it, then retry.\n",
  );
  process.exit(1);
}
if (!process.env.ALLOWED_ORIGIN) process.env.ALLOWED_ORIGIN = "http://localhost:5173";

const server = createServer(async (req, res) => {
  try {
    const url = `http://localhost:${PORT}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
    }

    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks);
    }

    const webReq = new Request(url, { method: req.method, headers, body });
    const webRes = await handleRequest(webReq, process.env);

    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => res.setHeader(key, value));

    if (webRes.body) {
      for await (const chunk of webRes.body) res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error("dev-server error:", err?.message || err);
    if (!res.headersSent) res.statusCode = 500;
    res.end(JSON.stringify({ error: "dev server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Gemini proxy (dev)  ->  http://localhost:${PORT}/chat`);
  console.log(`  model: ${process.env.GEMINI_MODEL || "gemini-2.0-flash"}`);
  console.log(`  allowed origin: ${process.env.ALLOWED_ORIGIN}`);
  console.log(`  point the frontend at it:  VITE_PROXY_URL=http://localhost:${PORT}\n`);
});
