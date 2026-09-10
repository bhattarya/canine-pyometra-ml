// ESM module — no dependencies.
// Builds the system instruction sent to Gemini for the canine-pyometra
// decision-support assistant, and exposes the underlying model facts.

/**
 * Stable description of what the ML model is and is not. Kept as a constant so
 * the wording is identical everywhere and easy to audit.
 * @type {string}
 */
export const MODEL_FACTS = [
  "The model is an L2-regularised logistic-regression estimate of the probability that the",
  "SELECTED treatment protocol achieves an uncomplicated resolution of canine pyometra by day 14.",
  "Inputs are the intended protocol (G1 supportive, G2 cloprostenol/PGF2-alpha,",
  "G3 aglepristone + cloprostenol, G4 ovariohysterectomy) plus nine routine admission values:",
  "age, illness duration, heart rate, total leucocyte count, creatinine, albumin, ALP,",
  "uterine diameter, and a 0-10 clinical severity score.",
  "It was trained on a single-centre teaching dataset of 80 dogs (66 successes, 14 failures).",
  "Internal cross-validated discrimination is ROC-AUC approximately 0.89.",
  "It has NOT been prospectively or externally validated.",
  "Probability bands used in the UI: below 50% reads as 'unlikely to succeed', 50-85% 'uncertain',",
  "above 85% 'likely'. The model is over-confident at the extremes on this clean dataset, so the",
  "band matters more than the exact percentage.",
  "The surgical arm (G4) had zero failures in the cohort (20/20). The model cannot estimate",
  "surgical risk, so for G4 the tool shows the observed cohort rate (~100%), not a model output.",
  "Observed day-14 success by protocol in the cohort: G1 65%, G2 75%, G3 90%, G4 100%. Arms were",
  "not randomised for severity, so this is observational protocol evidence, not a controlled trial.",
].join(" ");

function fmtPct(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "unknown";
  return `${(n * 100).toFixed(n >= 0.1 && n <= 0.9 ? 0 : 1)}%`;
}

function fmtValues(values) {
  if (!values || typeof values !== "object") return "  (none provided)";
  const entries = Object.entries(values).filter(
    ([, v]) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)),
  );
  if (entries.length === 0) return "  (none provided)";
  return entries.map(([k, v]) => `  - ${k}: ${v}`).join("\n");
}

function fmtDrivers(drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return "  (no individual drivers supplied)";
  }
  const supports = [];
  const against = [];
  for (const d of drivers) {
    if (!d || typeof d !== "object") continue;
    const label = String(d.label ?? "unnamed factor");
    const eff = String(d.effect ?? d.direction ?? "").toLowerCase();
    if (eff.startsWith("support") || eff.startsWith("raise") || eff === "up") {
      supports.push(label);
    } else if (eff.startsWith("against") || eff.startsWith("lower") || eff === "down") {
      against.push(label);
    } else {
      against.push(`${label} (effect "${d.effect ?? d.direction}")`);
    }
  }
  return [
    `  - Supporting success in this case: ${supports.length ? supports.join(", ") : "none"}`,
    `  - Working against success: ${against.length ? against.join(", ") : "none"}`,
  ].join("\n");
}

/**
 * @param {object} caseContext
 * @param {string}  [caseContext.groupLabel]
 * @param {Record<string, number>} [caseContext.values]
 * @param {number}  caseContext.probability
 * @param {string}  [caseContext.band]
 * @param {boolean} [caseContext.observedOnly]
 * @param {Array<{label: string, effect: string}>} [caseContext.drivers]
 * @param {number}  [caseContext.modelAuc]
 * @param {string}  [caseContext.disclaimer]
 * @returns {string}
 */
export function buildSystemPrompt(caseContext = {}) {
  const {
    groupLabel,
    values,
    probability,
    band,
    observedOnly,
    drivers,
    modelAuc,
    disclaimer,
  } = caseContext || {};

  const bandText = band ? String(band) : "not supplied";
  const aucText = Number.isFinite(Number(modelAuc))
    ? Number(modelAuc).toFixed(3)
    : "~0.89 (internal cross-validation)";
  const protoLine = observedOnly
    ? `${fmtPct(probability)} — this is the OBSERVED cohort success rate for surgery, not a model estimate`
    : `${fmtPct(probability)} (model estimate)`;

  return `You are a veterinary decision-support assistant explaining the output of a machine-learning model for canine pyometra. You are talking to a veterinarian.

MODEL FACTS (authoritative — do not contradict these):
${MODEL_FACTS}
Reported model discrimination for this deployment: ROC-AUC ${aucText}.

HOW TO RESPOND:
- Explain, in plain clinical terms: the estimated probability of success for the chosen protocol, which admission values support or work against success in this case, what the band means, and the observed protocol evidence from the cohort.
- Be concise: a few short paragraphs at most.
- Do NOT give definitive treatment directives, specific drug doses, or a single "do this" instruction.
- Always defer to the attending clinician's judgement and the patient's full picture.
- If asked something the model or its training data cannot answer (surgical risk for a specific dog, dosing, a different species or disease, anything outside day-14 protocol success), say plainly that this is outside what the model can tell you.
- Never claim the model is validated for clinical use; it is a single-centre teaching model.

CURRENT CASE:
  Selected protocol: ${groupLabel ? String(groupLabel) : "not supplied"}
  Entered values:
${fmtValues(values)}
  Predicted chance of treatment success by day 14: ${protoLine}
  Band: ${bandText}
  Drivers:
${fmtDrivers(drivers)}
${disclaimer ? `\n  Disclaimer shown to the user: ${String(disclaimer)}` : ""}`;
}

export default buildSystemPrompt;
