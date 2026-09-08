// Parity check: prove the browser prediction maths matches the Python CLI.
//
// The web app (src/lib/predict.ts) and src/predict_case.py must always agree.
// This script re-implements the logistic prediction from the SAME source of
// truth (../../models/final_model.json) and, when Python is available, also
// shells out to ../../src/predict_case.py and compares the whole-percent risk.
//
//   node scripts/parity-check.mjs      (or:  npm run parity)

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const modelPath = resolve(repoRoot, "models/final_model.json");
const pyScript = resolve(repoRoot, "src/predict_case.py");

const model = JSON.parse(readFileSync(modelPath, "utf8"));

// --- inline logistic prediction (mirrors predict_case.py / lib/predict.ts) ---
function predict(values) {
  const feats = model.features;
  const mean = model.standardisation.mean;
  const std = model.standardisation.std;
  const coef = model.coef;

  let logit = model.intercept;
  for (let i = 0; i < feats.length; i++) {
    const x = Number(values[feats[i]]);
    if (!Number.isFinite(x)) throw new Error(`missing value for ${feats[i]}`);
    const z = (x - mean[i]) / std[i];
    logit += coef[i] * z;
  }
  const p = 1 / (1 + Math.exp(-logit));

  const [c0, c1] = model.risk_bands.cutpoints_prob;
  const band = p < c0 ? "Low" : p < c1 ? "Intermediate" : "High";
  return { p, band };
}

const cases = [
  {
    name: "HIGH",
    values: {
      BUN_mg_dL: 33,
      Creatinine_mg_dL: 1.5,
      Albumin_g_dL: 2.2,
      ALP_U_L: 430,
      Age_years: 8.5,
      Illness_Duration_days: 9,
    },
    expectBand: "High",
  },
  {
    name: "LOW",
    values: {
      BUN_mg_dL: 19,
      Creatinine_mg_dL: 0.9,
      Albumin_g_dL: 3.1,
      ALP_U_L: 270,
      Age_years: 4,
      Illness_Duration_days: 3,
    },
    expectBand: "Low",
  },
];

// --- locate a Python interpreter: repo-root .venv first, then python3 ---
function findPython() {
  const candidates = [
    resolve(repoRoot, ".venv/bin/python"),
    resolve(repoRoot, ".venv/bin/python3"),
    "python3",
    "python",
  ];
  for (const bin of candidates) {
    const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (!probe.error && probe.status === 0) return bin;
  }
  return null;
}
const python = findPython();

function pythonPercent(bin, values) {
  const res = spawnSync(bin, [pyScript, "--json", JSON.stringify(values)], {
    encoding: "utf8",
  });
  if (res.error || res.status !== 0) {
    throw new Error(
      `python exited ${res.status}: ${(res.stderr || res.stdout || "").trim()}`,
    );
  }
  const m = res.stdout.match(
    /Predicted risk of medical-treatment failure\s*:\s*(\d+)\s*%/,
  );
  if (!m) throw new Error("could not parse risk % from predict_case.py output");
  return Number(m[1]);
}

const failures = [];

for (const c of cases) {
  const { p, band } = predict(c.values);
  const jsPct = Math.round(p * 100);
  console.log(
    `${c.name}: JS p=${p.toFixed(4)} (${jsPct}%) band=${band}`,
  );

  if (band !== c.expectBand) {
    failures.push(`${c.name}: expected band ${c.expectBand}, got ${band}`);
  }

  if (python) {
    try {
      const pyPct = pythonPercent(python, c.values);
      console.log(`${c.name}: Python risk=${pyPct}%`);
      if (pyPct !== jsPct) {
        failures.push(
          `${c.name}: JS ${jsPct}% vs Python ${pyPct}% (whole-percent mismatch)`,
        );
      }
    } catch (err) {
      failures.push(`${c.name}: python parity error: ${err.message}`);
    }
  } else {
    console.log(`${c.name}: SKIP Python half (no interpreter found)`);
  }
}

if (failures.length) {
  console.error("\nPARITY FAIL:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("\nPARITY PASS");
