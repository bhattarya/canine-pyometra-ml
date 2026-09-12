import raw from "../data/model.json";

/** Shape of models/final_model.json (produced by 13_finalize_treatment_model.py). */
export interface TreatmentModel {
  task: "treatment_success";
  name: string;
  generated: string;
  outcome: string;
  cohort: string;
  numeric_features: string[];
  labels: Record<string, string>;
  units: Record<string, string>;
  ref_ranges: Record<string, string>;
  step: Record<string, number>;
  standardisation: { mean: number[]; std: number[] };
  numeric_coef: number[];
  groups: string[];
  group_labels: Record<string, string>;
  group_reference: string;
  group_coef: Record<string, number>;
  intercept: number;
  performance: {
    roc_auc_cv: number;
    roc_auc_cv_sd: number;
    roc_auc_apparent: number;
    accuracy_cv: number;
    accuracy_cv_sd: number;
    sensitivity_cv: number;
    sensitivity_cv_sd: number;
    specificity_cv: number;
    specificity_cv_sd: number;
    f1_cv: number;
    f1_cv_sd: number;
    roc_curve: { fpr: number[]; tpr: number[] };
    cv: string;
  };
  success_bands: {
    cutpoints_prob: [number, number];
    table: Record<SuccessBand, { n: number; observed_success_rate: number | null }>;
  };
  protocol_observed: Record<string, { n: number; success_rate: number }>;
  input_ranges: Record<
    string,
    { min: number; max: number; p05: number; p95: number; median: number }
  >;
  display: {
    success_by_protocol: { group: string; n: number; success_rate: number }[];
    top_predictors: { variable: string; auc: number }[];
  };
  g4_caveat: string;
  disclaimer: string;
}

export type SuccessBand = "Unlikely" | "Uncertain" | "Likely";

export const MODEL = raw as unknown as TreatmentModel;

/** Group id that gets the observed-rate treatment rather than the model value. */
export const OBSERVED_ONLY_GROUP = "G4_OHE";

export const groupLabel = (g: string): string => MODEL.group_labels[g] ?? g;

export const NICE_NAME: Record<string, string> = {
  Age_years: "Age",
  Illness_Duration_days: "Illness duration",
  Heart_Rate_bpm: "Heart rate",
  TLC_per_uL: "Total leucocyte count",
  Neutrophils_per_uL: "Neutrophil count",
  Creatinine_mg_dL: "Serum creatinine",
  Albumin_g_dL: "Serum albumin",
  ALP_U_L: "Alkaline phosphatase",
  BUN_mg_dL: "Blood urea nitrogen",
  ALT_U_L: "Alanine aminotransferase",
};

/** A plausible worked example, values inside the cohort range. */
export const EXAMPLE: { group: string; values: Record<string, number> } = {
  group: "G3_Aglepristone_PGF2a",
  values: {
    Age_years: 6,
    Illness_Duration_days: 5,
    Heart_Rate_bpm: 118,
    TLC_per_uL: 19,
    Neutrophils_per_uL: 15,
    Creatinine_mg_dL: 1.0,
    Albumin_g_dL: 2.7,
    ALP_U_L: 300,
    ALT_U_L: 85,
  },
};
