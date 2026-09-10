// Parity check: prove the browser prediction maths matches the Python CLI.
//
// The web app (src/lib/predict.ts) and src/predict_case.py must always agree.
// This script re-implements the treatment-success logistic prediction from the
// SAME source of truth (../../models/final_model.json) and, when Python is
// available, also shells out to ../../src/predict_case.py and compares the
// whole-percent success probability.
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

// --- inline prediction (mirrors predict_case.py / lib/predict.ts) ---
function predict(values, group) {
  const feats = model.numeric_features;
  const { mean, std } = model.standardisation;
  const coef = model.numeric_coef;

  let logit = model.intercept + (model.group_coef[group] ?? 0);
  for (let i = 0; i < feats.length; i++) {
    const x = Number(values[feats[i]]);
    if (!Number.isFinite(x)) throw new Error(`missing value for ${feats[i]}`);
    logit += coef[i] * ((x - mean[i]) / std[i]);
  }
  const pModel = 1 / (1 + Math.exp(-logit));
  // G4/surgery: report observed cohort rate, not the extrapolated model value
  const p =
    group === "G4_OHE"
      ? model.protocol_observed[group].success_rate
      : pModel;

  const [lo, hi] = model.success_bands.cutpoints_prob;
  const band = p < lo ? "Unlikely" : p < hi ? "Uncertain" : "Likely";
  return { p, band };
}

const baseline = {
  Age_years: 6,
  Illness_Duration_days: 5,
  Heart_Rate_bpm: 120,
  TLC_per_uL: 19,
  Creatinine_mg_dL: 1.0,
  Albumin_g_dL: 2.7,
  ALP_U_L: 310,
  Uterine_Diameter_mm: 17,
  Clinical_VAS_0_10: 5,
};
const sick = {
  ...baseline,
  Age_years: 9,
  Illness_Duration_days: 9,
  Heart_Rate_bpm: 145,
  Creatinine_mg_dL: 1.6,
  Albumin_g_dL: 2.2,
  ALP_U_L: 470,
  Clinical_VAS_0_10: 8,
};

const cases = [
  { name: "G3 baseline", values: baseline, group: "G3_Aglepristone_PGF2a", expectBand: "Likely" },
  { name: "G1 sick", values: sick, group: "G1_Supportive", expectBand: "Unlikely" },
  { name: "G4 (observed)", values: sick, group: "G4_OHE", expectBand: "Likely" },
];

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

function pythonPercent(bin, values, group) {
  const res = spawnSync(
    bin,
    [pyScript, "--group", group, "--json", JSON.stringify(values)],
    { encoding: "utf8" },
  );
  if (res.error || res.status !== 0) {
    throw new Error(
      `python exited ${res.status}: ${(res.stderr || res.stdout || "").trim()}`,
    );
  }
  const m = res.stdout.match(/chance of treatment success\s*:\s*(\d+)\s*%/);
  if (!m) throw new Error("could not parse success % from predict_case.py output");
  return Number(m[1]);
}

const failures = [];

for (const c of cases) {
  const { p, band } = predict(c.values, c.group);
  const jsPct = Math.round(p * 100);
  console.log(`${c.name}: JS p=${p.toFixed(4)} (${jsPct}%) band=${band}`);

  if (band !== c.expectBand) {
    failures.push(`${c.name}: expected band ${c.expectBand}, got ${band}`);
  }

  if (python) {
    try {
      const pyPct = pythonPercent(python, c.values, c.group);
      console.log(`${c.name}: Python success=${pyPct}%`);
      if (pyPct !== jsPct) {
        failures.push(`${c.name}: JS ${jsPct}% vs Python ${pyPct}% (mismatch)`);
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
