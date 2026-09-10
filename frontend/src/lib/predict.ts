import { MODEL, OBSERVED_ONLY_GROUP, type SuccessBand } from "./model";

export interface Driver {
  feature: string;
  label: string;
  value: number;
  logOdds: number; // contribution toward success
  effect: "supports" | "against" | "neutral";
}

export interface Prediction {
  group: string;
  /** shown probability of treatment success (0..1) */
  probability: number;
  /** raw model probability (differs from `probability` only for the surgical arm) */
  modelProbability: number;
  band: SuccessBand;
  observedOnly: boolean; // true for the surgical arm
  observedForGroup: number;
  drivers: Driver[]; // sorted by |logOdds| desc
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const NEUTRAL = 0.12; // |log-odds| below this reads as "no meaningful push"

export function bandFor(p: number): SuccessBand {
  const [lo, hi] = MODEL.success_bands.cutpoints_prob;
  return p < lo ? "Unlikely" : p < hi ? "Uncertain" : "Likely";
}

/**
 * Same maths as src/predict_case.py:
 * z-score each numeric value, add the protocol term, squash. The surgical arm
 * (G4) has no outcome variance in the cohort, so we display its observed rate.
 */
export function predict(values: Record<string, number>, group: string): Prediction {
  const { numeric_features, standardisation, numeric_coef, labels } = MODEL;
  const parts = numeric_features.map((f, i) => {
    const z = (values[f] - standardisation.mean[i]) / standardisation.std[i];
    return numeric_coef[i] * z;
  });
  const groupTerm = MODEL.group_coef[group] ?? 0;
  const linear = MODEL.intercept + groupTerm + parts.reduce((a, b) => a + b, 0);
  const modelProbability = sigmoid(linear);

  const observedOnly = group === OBSERVED_ONLY_GROUP;
  const observedForGroup = MODEL.protocol_observed[group]?.success_rate ?? modelProbability;
  const probability = observedOnly ? observedForGroup : modelProbability;

  const drivers: Driver[] = numeric_features
    .map((f, i) => ({
      feature: f,
      label: labels[f].replace(/\s*\([^)]*\)\s*$/, ""),
      value: values[f],
      logOdds: parts[i],
      effect:
        Math.abs(parts[i]) < NEUTRAL
          ? ("neutral" as const)
          : parts[i] > 0
            ? ("supports" as const)
            : ("against" as const),
    }))
    .sort((a, b) => Math.abs(b.logOdds) - Math.abs(a.logOdds));

  return {
    group,
    probability,
    modelProbability,
    band: bandFor(probability),
    observedOnly,
    observedForGroup,
    drivers,
  };
}
