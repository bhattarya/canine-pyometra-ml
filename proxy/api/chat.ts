// Vercel Edge Function. Plain TypeScript the edge runtime accepts directly — no
// build step, no type-only imports that need resolution. All behaviour lives in
// the shared ESM modules, imported by relative path.
//
// This file sits at `proxy/api/chat.ts` and the Vercel project's Root Directory
// is `proxy`, so `../shared/*` is a sibling of `api/` — always inside the root
// and always bundled into the function.
//
// Env vars (Project -> Settings -> Environment Variables):
//   GEMINI_API_KEY   (required)
//   GEMINI_MODEL     (optional, default "gemini-flash-latest")
//   ALLOWED_ORIGIN   (optional, default "*")
//
// Endpoint: POST https://<project>.vercel.app/api/chat

// @ts-ignore -- resolved at runtime by the edge bundler, not the TS checker.
import { handleRequest } from "../shared/handler.js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  // On Vercel Edge, process.env carries the configured variables.
  const env = (globalThis as any)?.process?.env ?? {};
  return handleRequest(req, env);
}
