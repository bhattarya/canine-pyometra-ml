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
  mode: "summary",
  caseContext: {
    groupLabel: "G3 - aglepristone + cloprostenol",
    probability: 0.9,
    band: "Likely",
    observedOnly: false,
    values: {
      Age: { value: 6, unit: "years", flag: null },
      "Illness duration": { value: 5, unit: "days", flag: null },
      "Heart rate": { value: 118, unit: "bpm", flag: null },
      "Total leucocyte count": { value: 19, unit: "x10^3/uL", flag: "high" },
      "Serum creatinine": { value: 1.0, unit: "mg/dL", flag: null },
      "Serum albumin": { value: 2.7, unit: "g/dL", flag: null },
      "Alkaline phosphatase (ALP)": { value: 300, unit: "U/L", flag: "very high" },
      "Uterine diameter": { value: 17, unit: "mm", flag: null },
      "Clinical severity (VAS 0-10)": { value: 5, unit: "0-10", flag: null },
    },
    drivers: [
      { label: "Alkaline phosphatase", effect: "supports" },
      { label: "Serum creatinine", effect: "supports" },
    ],
    protocolObserved: {
      G1_Supportive: { n: 20, success_rate: 0.65 },
      G2_PGF2a: { n: 20, success_rate: 0.75 },
      G3_Aglepristone_PGF2a: { n: 20, success_rate: 0.9 },
      G4_OHE: { n: 20, success_rate: 1.0 },
    },
    modelAuc: 0.894,
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
  console.log(`PASS — streamed ${text.length} chars from ${process.env.GEMINI_MODEL || "gemini-flash-latest"}`);
} else {
  console.error("FAIL — response was empty or too short");
  process.exit(1);
}
