// ESM module — no dependencies.
// Builds the system instruction sent to Gemini for the canine-pyometra
// decision-support assistant, and exposes the underlying model facts.

/**
 * Stable description of what the ML model is and is not. Kept as a constant so
 * the wording is identical everywhere and easy to audit.
 * @type {string}
 */
export const MODEL_FACTS = [
  "The model is an L2-regularised logistic-regression estimate of the probability that MEDICAL",
  "management of canine pyometra FAILS by day 14. Failure is defined as death, rescue",
  "ovariohysterectomy, or non-response to medical therapy.",
  "It was trained on a single-centre teaching dataset of 80 dogs containing only 14 failure events.",
  "Internal cross-validated discrimination is ROC-AUC approximately 0.95.",
  "The model has NOT been prospectively validated and has NOT been externally validated on any",
  "other population.",
  "Risk bands: Low is below 10%, Intermediate is 10-40%, High is above 40%.",
  "In the study cohort no medically managed dog with an estimated failure probability below 40%",
  "actually failed; above 40% roughly half failed.",
  "Within that cohort, aglepristone combined with PGF2-alpha, and ovariohysterectomy, did markedly",
  "better than PGF2-alpha alone or supportive care alone. This is observational protocol evidence",
  "from a small sample, not a controlled comparison.",
].join(" ");

function fmtPct(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "unknown";
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
}

function fmtValues(values) {
  if (!values || typeof values !== "object") return "  (none provided)";
  const entries = Object.entries(values).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return "  (none provided)";
  return entries.map(([k, v]) => `  - ${k}: ${v}`).join("\n");
}

function fmtDrivers(drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return "  (no individual drivers supplied)";
  }
  const raises = [];
  const lowers = [];
  for (const d of drivers) {
    if (!d || typeof d !== "object") continue;
    const label = String(d.label ?? "unnamed factor");
    const dir = String(d.direction ?? "").toLowerCase();
    if (dir.startsWith("raise") || dir === "up" || dir === "increases") {
      raises.push(label);
    } else if (dir.startsWith("lower") || dir === "down" || dir === "decreases") {
      lowers.push(label);
    } else {
      raises.push(`${label} (direction "${d.direction}")`);
    }
  }
  const lines = [];
  lines.push(
    `  - Raising predicted failure risk: ${raises.length ? raises.join(", ") : "none"}`
  );
  lines.push(
    `  - Lowering predicted failure risk: ${lowers.length ? lowers.join(", ") : "none"}`
  );
  return lines.join("\n");
}

/**
 * @param {object} caseContext
 * @param {Record<string, number>} [caseContext.values]
 * @param {number} caseContext.probability
 * @param {string} [caseContext.band]
 * @param {Array<{label: string, direction: string}>} [caseContext.drivers]
 * @param {number} [caseContext.modelAuc]
 * @param {string} [caseContext.disclaimer]
 * @returns {string}
 */
export function buildSystemPrompt(caseContext = {}) {
  const {
    values,
    probability,
    band,
    drivers,
    modelAuc,
    disclaimer,
  } = caseContext || {};

  const bandText = band ? String(band) : "not supplied";
  const aucText = Number.isFinite(Number(modelAuc))
    ? Number(modelAuc).toFixed(3)
    : "~0.95 (internal cross-validation)";

  return `You are a veterinary decision-support assistant explaining the output of a machine-learning model for canine pyometra. You are talking to a veterinarian.

MODEL FACTS (authoritative — do not contradict these):
${MODEL_FACTS}
Reported model discrimination for this deployment: ROC-AUC ${aucText}.

HOW TO RESPOND:
- Explain, in plain clinical terms: the estimated probability, the risk drivers for this case, what the risk band means, and the observed protocol evidence from the study cohort.
- Be concise: a few short paragraphs at most.
- Do NOT give definitive treatment directives, specific drug doses, or a single "do this" instruction.
- Always defer to the attending clinician's judgement and to the individual patient's full picture.
- If asked something the model or its training data cannot answer (e.g. prognosis for surgery, dosing, a different species or disease, anything outside day-14 medical-management failure), say plainly that this is outside what the model can tell you.
- Never claim the model is validated for clinical use; it is a single-centre teaching model.

CURRENT CASE:
  Entered values:
${fmtValues(values)}
  Estimated probability that medical management fails by day 14: ${fmtPct(probability)}
  Risk band: ${bandText}
  Risk drivers:
${fmtDrivers(drivers)}
${disclaimer ? `\n  Disclaimer shown to the user: ${String(disclaimer)}` : ""}`;
}

export default buildSystemPrompt;
