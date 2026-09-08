// ESM module — no dependencies. Runtime-agnostic request handler shared by the
// Cloudflare Worker and the Vercel edge function. Both runtimes give it a
// standard `Request` and a plain `env` object; it returns a standard `Response`.

import { buildSystemPrompt } from "./systemPrompt.js";
import { streamGemini } from "./gemini.js";

const DEFAULT_MODEL = "gemini-2.0-flash";
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 4000;
const VALID_ROLES = new Set(["user", "assistant"]);

function readEnv(env) {
  const e = env || {};
  return {
    apiKey: e.GEMINI_API_KEY,
    model: e.GEMINI_MODEL || DEFAULT_MODEL,
    allowedOrigin: e.ALLOWED_ORIGIN || "*",
  };
}

function corsHeaders(allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

function jsonError(message, status, allowedOrigin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(allowedOrigin),
    },
  });
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, messages: any[], caseContext: any } | { ok: false, error: string }}
 */
function validateBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const { messages, caseContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "`messages` must be a non-empty array." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Too many messages (max ${MAX_MESSAGES}).` };
  }
  for (const m of messages) {
    if (!m || typeof m !== "object") {
      return { ok: false, error: "Each message must be an object." };
    }
    if (!VALID_ROLES.has(m.role)) {
      return { ok: false, error: "Each message role must be 'user' or 'assistant'." };
    }
    if (typeof m.content !== "string") {
      return { ok: false, error: "Each message content must be a string." };
    }
    if (m.content.length > MAX_CONTENT_CHARS) {
      return {
        ok: false,
        error: `Message content exceeds ${MAX_CONTENT_CHARS} characters.`,
      };
    }
  }

  if (!caseContext || typeof caseContext !== "object") {
    return { ok: false, error: "`caseContext` is required." };
  }
  if (typeof caseContext.probability !== "number" || !Number.isFinite(caseContext.probability)) {
    return { ok: false, error: "`caseContext.probability` must be a number." };
  }

  return { ok: true, messages, caseContext };
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env) {
  const { apiKey, model, allowedOrigin } = readEnv(env);
  const cors = corsHeaders(allowedOrigin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(request.url);
  if (!url.pathname.replace(/\/+$/, "").endsWith("/chat")) {
    return jsonError("Not found.", 404, allowedOrigin);
  }
  if (request.method !== "POST") {
    return jsonError("Method not allowed.", 405, allowedOrigin);
  }

  if (!apiKey) {
    // Misconfiguration — do not hint at the key name in a way that leaks its value (there is none).
    return jsonError("Server is not configured.", 500, allowedOrigin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400, allowedOrigin);
  }

  const check = validateBody(body);
  if (!check.ok) {
    return jsonError(check.error, 400, allowedOrigin);
  }

  const systemPrompt = buildSystemPrompt(check.caseContext);
  const stream = streamGemini({
    apiKey,
    model,
    systemPrompt,
    messages: check.messages,
    signal: request.signal,
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...cors,
    },
  });
}

export default handleRequest;
