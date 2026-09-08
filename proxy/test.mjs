// Real end-to-end test — calls the actual Gemini API through the shared handler.
// You run this with YOUR OWN fresh key; it is never committed anywhere.
//
//   cd proxy
//   GEMINI_API_KEY=your_fresh_key node test.mjs
//   # or, if proxy/.dev.vars exists:  node test.mjs
//
// Prints the streamed answer and a PASS/FAIL. Exit code 1 on failure.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./shared/handler.js";

const HERE = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(HERE, ".dev.vars"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* fall back to real env */
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY not set (env or proxy/.dev.vars). Aborting.");
  process.exit(1);
}
process.env.ALLOWED_ORIGIN ||= "*";

const body = {
  messages: [
    { role: "user", content: "In two sentences, why is this dog's case high risk, and what does the band mean?" },
  ],
  caseContext: {
    values: {
      BUN_mg_dL: 33,
      Creatinine_mg_dL: 1.5,
      Albumin_g_dL: 2.2,
      ALP_U_L: 430,
      Age_years: 8.5,
      Illness_Duration_days: 9,
    },
    probability: 0.98,
    band: "High",
    drivers: [
      { label: "Albumin", direction: "raises" },
      { label: "Blood urea nitrogen", direction: "raises" },
      { label: "Age", direction: "lowers" },
    ],
    modelAuc: 0.948,
    disclaimer: "Research preview — not a validated clinical tool.",
  },
};

const req = new Request("http://localhost/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

console.log("→ calling Gemini via the shared proxy handler…\n");
const res = await handleRequest(req, process.env);

if (!res.ok) {
  console.error(`FAIL — handler returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

let text = "";
for await (const chunk of res.body) {
  const s = Buffer.from(chunk).toString("utf8");
  text += s;
  process.stdout.write(s);
}

console.log("\n");
if (text.trim().length > 20) {
  console.log(`PASS — streamed ${text.length} chars from ${process.env.GEMINI_MODEL || "gemini-2.0-flash"}`);
} else {
  console.error("FAIL — response was empty or too short");
  process.exit(1);
}
