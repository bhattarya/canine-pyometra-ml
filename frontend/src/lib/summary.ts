import { MODEL, groupLabel } from "./model";
import type { Prediction } from "./predict";
import { pct, pct1 } from "./format";

/* Canine reference intervals used to describe the admission bloods in words.
   Clinical, not cohort-derived — a vet reads "above the reference interval"
   more easily than "above the 95th percentile of 80 dogs". */
const REF: Record<string, { lo?: number; hi?: number; unit: string }> = {
  Creatinine_mg_dL: { lo: 0.5, hi: 1.5, unit: "mg/dL" },
  Albumin_g_dL: { lo: 2.6, hi: 4.0, unit: "g/dL" },
  ALP_U_L: { hi: 150, unit: "U/L" },
  TLC_per_uL: { lo: 6, hi: 17, unit: "×10³/µL" },
  Heart_Rate_bpm: { lo: 70, hi: 120, unit: "bpm" },
};

const g1 = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

function classify(feature: string, v: number): "low" | "normal" | "high" | "very high" | null {
  const r = REF[feature];
  if (!r) return null;
  if (r.lo !== undefined && v < r.lo) return "low";
  if (r.hi !== undefined && v > r.hi) {
    if (feature === "ALP_U_L" && v > 400) return "very high";
    if (feature === "Creatinine_mg_dL" && v > 2.0) return "very high";
    return "high";
  }
  return "normal";
}

/** Structured, grounded context handed to the AI summary proxy. */
export function buildAiContext(
  group: string,
  values: Record<string, number>,
  prediction: Prediction,
) {
  const labelled: Record<string, { value: number; unit: string; flag: string | null }> = {};
  for (const f of MODEL.numeric_features) {
    labelled[MODEL.labels[f]] = {
      value: values[f],
      unit: MODEL.units[f] ?? "",
      flag: classify(f, values[f]),
    };
  }
  return {
    groupLabel: groupLabel(group),
    probability: prediction.probability,
    band: prediction.band,
    observedOnly: prediction.observedOnly,
    values: labelled,
    drivers: prediction.drivers
      .filter((d) => d.effect !== "neutral")
      .map((d) => ({ label: d.label, effect: d.effect })),
    protocolObserved: MODEL.protocol_observed,
    modelAuc: MODEL.performance.roc_auc_cv,
  };
}

export function buildSummary(
  group: string,
  values: Record<string, number>,
  prediction: Prediction,
): string[] {
  const v = values;
  const label = groupLabel(group);
  const paras: string[] = [];

  // 1 — the case
  const age = v.Age_years;
  const ageWord =
    age >= 8 ? "an older" : age <= 4 ? "a young" : "a middle-aged";
  paras.push(
    `This is ${ageWord} bitch (${g1(age)} yr) presenting with pyometra after ` +
      `${g1(v.Illness_Duration_days)} day${v.Illness_Duration_days === 1 ? "" : "s"} of illness. ` +
      `The intended protocol is ${label}.`,
  );

  // 2 — the admission picture
  const cr = classify("Creatinine_mg_dL", v.Creatinine_mg_dL);
  const alb = classify("Albumin_g_dL", v.Albumin_g_dL);
  const alp = classify("ALP_U_L", v.ALP_U_L);
  const tlc = classify("TLC_per_uL", v.TLC_per_uL);
  const hr = classify("Heart_Rate_bpm", v.Heart_Rate_bpm);

  const renal =
    cr === "very high"
      ? `marked azotaemia (creatinine ${g1(v.Creatinine_mg_dL)} mg/dL)`
      : cr === "high"
        ? `mild azotaemia (creatinine ${g1(v.Creatinine_mg_dL)} mg/dL)`
        : `normal renal function (creatinine ${g1(v.Creatinine_mg_dL)} mg/dL)`;
  const albText =
    alb === "low"
      ? `hypoalbuminaemia (albumin ${g1(v.Albumin_g_dL)} g/dL)`
      : `albumin ${g1(v.Albumin_g_dL)} g/dL (within range)`;
  const alpText =
    alp === "very high"
      ? `a markedly raised ALP (${g1(v.ALP_U_L)} U/L)`
      : alp === "high"
        ? `a raised ALP (${g1(v.ALP_U_L)} U/L)`
        : `an ALP of ${g1(v.ALP_U_L)} U/L`;
  const tlcText =
    tlc === "high"
      ? `leucocytosis (${g1(v.TLC_per_uL)} ×10³/µL)`
      : tlc === "low"
        ? `leucopenia (${g1(v.TLC_per_uL)} ×10³/µL)`
        : `a leucocyte count of ${g1(v.TLC_per_uL)} ×10³/µL`;
  const hrText = hr === "high" ? "tachycardic" : "not tachycardic";

  paras.push(
    `On admission the dog has ${renal} and ${albText}, with ${alpText} and ${tlcText}. ` +
      `She is ${hrText} (heart rate ${g1(v.Heart_Rate_bpm)} bpm), the clinical severity score is ` +
      `${g1(v.Clinical_VAS_0_10)}/10, and the uterus measures ${g1(v.Uterine_Diameter_mm)} mm on ultrasound.`,
  );

  // 3 — the estimate
  const [lo, hi] = MODEL.success_bands.cutpoints_prob;
  const bandPhrase =
    prediction.band === "Likely"
      ? "likely to succeed"
      : prediction.band === "Uncertain"
        ? "an uncertain outcome"
        : "unlikely to succeed with this protocol";
  if (prediction.observedOnly) {
    paras.push(
      `Every dog treated surgically in the cohort resolved uncomplicated (20/20), so the model ` +
        `cannot estimate surgical risk. The figure shown, ${pct(prediction.probability)}, is that ` +
        `observed rate — read it as "surgery resolved every cohort case", not as a calibrated prediction.`,
    );
  } else {
    paras.push(
      `For ${label}, the model estimates a ${pct(prediction.probability)} probability of ` +
        `uncomplicated resolution by day 14 — ${bandPhrase}. Estimates above ${hi * 100}% read as ` +
        `likely, ${lo * 100}–${hi * 100}% as uncertain, and below ${lo * 100}% as unlikely.`,
    );
  }

  // 4 — why
  if (!prediction.observedOnly) {
    const supporters = prediction.drivers
      .filter((d) => d.effect === "supports")
      .slice(0, 3)
      .map((d) => d.label.toLowerCase());
    const opposers = prediction.drivers
      .filter((d) => d.effect === "against")
      .slice(0, 3)
      .map((d) => d.label.toLowerCase());
    const list = (xs: string[]) =>
      xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

    if (opposers.length && supporters.length) {
      paras.push(
        `The admission values weighing against success are ${list(opposers)}; those in favour are ` +
          `${list(supporters)}.`,
      );
    } else if (opposers.length) {
      paras.push(`The main admission values weighing against success are ${list(opposers)}.`);
    } else if (supporters.length) {
      paras.push(
        `The admission values working in favour of success are ${list(supporters)}; nothing in the ` +
          `bloodwork argues strongly against it.`,
      );
    } else {
      paras.push(
        `No single admission value stands out strongly for or against success. The estimate mainly ` +
          `reflects this protocol's overall track record and an otherwise unremarkable admission picture.`,
      );
    }
  }

  // 5 — cohort context
  const obs = MODEL.protocol_observed[group];
  const grad = MODEL.display.success_by_protocol
    .map((r) => `${groupLabel(r.group).split(" ")[0]} ${Math.round(r.success_rate * 100)}%`)
    .join(", ");
  paras.push(
    `For context, ${label} resolved ${pct1(obs.success_rate)} of the ${obs.n} cohort dogs it was ` +
      `used on. Observed day-14 resolution by protocol was ${grad}, but the arms were not randomised ` +
      `for severity, so read the gradient rather than the exact figures.`,
  );

  // 6 — how much to trust it
  paras.push(
    `This is a decision-support estimate from a small single-centre teaching dataset ` +
      `(80 dogs, 14 failures; internal ROC-AUC ≈ ${MODEL.performance.roc_auc_cv}). It is better at ` +
      `confirming likely successes than at flagging likely failures, and on this clean dataset it is ` +
      `over-confident near 0% and 100% — so weigh the band, not the exact percentage, against the ` +
      `whole clinical picture. It complements, and does not replace, clinical judgement.`,
  );

  return paras;
}
