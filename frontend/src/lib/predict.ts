import { MODEL, type Band } from "./model";

export interface Driver {
  feature: string;
  label: string;
  value: number;
  logOdds: number; // contribution to the linear predictor
  direction: "raises" | "lowers";
}

export interface Prediction {
  probability: number; // P(medical failure by day 14)
  band: Band;
  drivers: Driver[]; // sorted by |contribution| desc
  linear: number;
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export function bandFor(p: number): Band {
  const [lo, hi] = MODEL.risk_bands.cutpoints_prob;
  return p < lo ? "Low" : p < hi ? "Intermediate" : "High";
}

/**
 * Identical maths to src/predict_case.py:
 * z-score each feature, weight by the fitted coefficients, add the intercept,
 * squash with the logistic function.
 */
export function predict(values: Record<string, number>): Prediction {
  const { features, standardisation, coef, intercept, labels } = MODEL;
  const parts = features.map((f, i) => {
    const z = (values[f] - standardisation.mean[i]) / standardisation.std[i];
    return coef[i] * z;
  });
  const linear = intercept + parts.reduce((a, b) => a + b, 0);
  const probability = sigmoid(linear);

  const drivers: Driver[] = features
    .map((f, i) => ({
      feature: f,
      label: labels[f].replace(/\s*\([^)]*\)\s*$/, ""),
      value: values[f],
      logOdds: parts[i],
      direction: parts[i] > 0 ? ("raises" as const) : ("lowers" as const),
    }))
    .sort((a, b) => Math.abs(b.logOdds) - Math.abs(a.logOdds));

  return { probability, band: bandFor(probability), drivers, linear };
}

/** Observed protocol success rates for the band, best first. */
export function protocolContext(band: Band) {
  const hint = MODEL.protocol_hint[band] ?? {};
  return Object.entries(hint)
    .map(([group, v]) => ({ group, ...v }))
    .sort((a, b) => b.success_rate - a.success_rate);
}
