// ESM module — no dependencies.
// System instructions sent to Gemini. Two modes:
//   - summary : one-shot plain-English write-up of a single predicted case
//   - chat    : follow-up Q&A about that case (kept for completeness; the app
//               currently only uses summary mode)

/** Stable, auditable description of what the model is and is not. */
export const MODEL_FACTS = [
  "The model is an L2-regularised logistic regression that estimates the probability that the",
  "SELECTED treatment protocol achieves an uncomplicated resolution of canine pyometra by day 14.",
  "Protocols: G1 supportive/antibiotic, G2 cloprostenol (PGF2-alpha), G3 aglepristone + cloprostenol,",
  "G4 ovariohysterectomy (surgery).",
  "It was fitted on a single-centre teaching dataset of 80 dogs (66 successes, 14 failures),",
  "using the protocol plus nine admission values: age, illness duration, heart rate, total leucocyte",
  "count, neutrophil count, creatinine, albumin, ALP, and ALT.",
  "Internal cross-validated discrimination is ROC-AUC about 0.89. It has NOT been prospectively or",
  "externally validated.",
  "Probability bands: below 50% reads as 'unlikely to succeed', 50-85% 'uncertain', above 85% 'likely'.",
  "On this clean dataset the model is over-confident near 0% and 100%, so the band matters more than",
  "the exact percentage.",
  "The surgical arm (G4) had zero failures in the cohort (20/20); the model cannot estimate surgical",
  "risk, so for G4 the tool shows the observed cohort rate, not a model output.",
  "Observed day-14 resolution by protocol in the cohort: G1 65%, G2 75%, G3 90%, G4 100%. The arms",
  "were not randomised for severity, so this is observational protocol evidence, not a trial result.",
].join(" ");

function fmtPct(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "unknown";
  return `${(n * 100).toFixed(n >= 0.1 && n <= 0.9 ? 0 : 1)}%`;
}

function fmtValues(values) {
  if (!values || typeof values !== "object") return "  (none provided)";
  const rows = [];
  for (const [k, v] of Object.entries(values)) {
    if (!v || typeof v !== "object") continue;
    const flag = v.flag ? ` [${v.flag}]` : "";
    rows.push(`  - ${k}: ${v.value}${v.unit ? " " + v.unit : ""}${flag}`);
  }
  return rows.length ? rows.join("\n") : "  (none provided)";
}

function fmtDrivers(drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return "  (none identified — the estimate mostly reflects the protocol's overall track record)";
  }
  const s = [];
  const a = [];
  for (const d of drivers) {
    if (!d || typeof d !== "object") continue;
    const label = String(d.label ?? "factor");
    const eff = String(d.effect ?? "").toLowerCase();
    if (eff.startsWith("support")) s.push(label);
    else if (eff.startsWith("against")) a.push(label);
  }
  return [
    `  - Supporting success in this case: ${s.length ? s.join(", ") : "none"}`,
    `  - Working against success: ${a.length ? a.join(", ") : "none"}`,
  ].join("\n");
}

function fmtProtocolObserved(po) {
  if (!po || typeof po !== "object") return "  (not supplied)";
  return Object.entries(po)
    .map(([g, o]) => `  - ${g}: ${fmtPct(o && o.success_rate)} of ${o && o.n} dogs`)
    .join("\n");
}

function caseBlock(c = {}) {
  const {
    groupLabel,
    probability,
    band,
    observedOnly,
    values,
    drivers,
    protocolObserved,
    modelAuc,
  } = c;
  const aucText = Number.isFinite(Number(modelAuc)) ? Number(modelAuc).toFixed(3) : "~0.89";
  const probLine = observedOnly
    ? `${fmtPct(probability)} — this is the OBSERVED cohort success rate for surgery, NOT a model estimate`
    : `${fmtPct(probability)} (model estimate)`;
  return `THIS CASE (use only these facts; do not invent values or add new numbers):
  Selected protocol: ${groupLabel || "not supplied"}
  Admission values (flags are vs canine reference intervals):
${fmtValues(values)}
  Predicted probability of treatment success by day 14: ${probLine}
  Band: ${band || "not supplied"}
  Model-identified drivers for this case:
${fmtDrivers(drivers)}
  Observed success by protocol in the 80-dog cohort:
${fmtProtocolObserved(protocolObserved)}
  Reported model discrimination: ROC-AUC ${aucText} (internal cross-validation).`;
}

/**
 * One-shot summary. Returns the system instruction; send a single user turn
 * such as "Write the summary now." alongside it.
 * @param {object} caseContext
 * @returns {string}
 */
export function buildSummaryPrompt(caseContext = {}) {
  return `You are a veterinary decision-support assistant. A machine-learning model has just produced a prediction for one dog with pyometra. Write a clear, plain-English summary of this specific case for the attending veterinarian.

MODEL FACTS (authoritative — never contradict or go beyond these):
${MODEL_FACTS}

${caseBlock(caseContext)}

WRITE THE SUMMARY:
- 4 to 6 short paragraphs, plain clinical English. No headings, no bullet lists, no markdown.
- Paragraph 1: describe the dog and its admission picture in words, interpreting the flagged values (e.g. azotaemia, hypoalbuminaemia, raised ALP, leucocytosis, tachycardia). Use only the values given.
- Then: state the predicted probability and what the band means for this protocol.
- Then: explain, from the drivers listed, which admission findings push the estimate up or down. If no drivers were identified, say the estimate mainly reflects the protocol's track record and an unremarkable admission picture.
- Then: give cohort context using the observed per-protocol rates supplied.
- Final paragraph: the limitations — small single-centre teaching dataset (80 dogs, 14 failures), better at confirming likely successes than flagging likely failures, over-confident at the extremes so weigh the band not the exact percentage; it complements and does not replace clinical judgement.
- Do NOT give treatment directives, drug doses, or a single "do this" instruction. Do NOT invent numbers, reference ranges, or facts not provided above.
- For the surgical arm, make clear the figure is the observed cohort rate, not a model estimate, and that surgical risk cannot be estimated from data with no failures.`;
}

/**
 * Chat mode (unused by the current app; kept so /chat still works).
 * @param {object} caseContext
 * @returns {string}
 */
export function buildSystemPrompt(caseContext = {}) {
  return `You are a veterinary decision-support assistant explaining a machine-learning prediction for canine pyometra to a veterinarian.

MODEL FACTS (authoritative — do not contradict):
${MODEL_FACTS}

${caseBlock(caseContext)}

HOW TO RESPOND:
- Answer the veterinarian's question concisely in plain clinical English (a few short paragraphs at most).
- Use only the facts above; do not invent numbers or clinical claims.
- No treatment directives, drug doses, or single "do this" instructions. Defer to the attending clinician.
- If the question is outside what the model or its data can address, say so plainly.`;
}

export default buildSummaryPrompt;
