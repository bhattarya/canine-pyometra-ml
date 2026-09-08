// Cloudflare Worker entrypoint. All behaviour lives in ../shared/handler.js so
// the Vercel edge function stays byte-for-byte equivalent.
//
//   wrangler dev cloudflare/worker.js
//   wrangler deploy cloudflare/worker.js
//   wrangler secret put GEMINI_API_KEY   # paste at prompt — never commit
//
// `env` on Cloudflare carries GEMINI_API_KEY (secret), plus GEMINI_MODEL and
// ALLOWED_ORIGIN from [vars] in wrangler.toml.

import { handleRequest } from "../shared/handler.js";

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string | undefined>} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
