import raw from "../data/model.json";

/** Shape of models/final_model.json (produced by 11_finalize_model.py). */
export interface FinalModel {
  name: string;
  generated: string;
  outcome: string;
  cohort: string;
  features: string[];
  labels: Record<string, string>;
  standardisation: { mean: number[]; std: number[] };
  coef: number[];
  intercept: number;
  performance: {
    roc_auc_cv: number;
    roc_auc_cv_sd: number;
    roc_auc_apparent: number;
    cv: string;
  };
  risk_bands: {
    cutpoints_prob: [number, number];
    table: Record<Band, { n: number; observed_failure_rate: number; observed_success_rate: number }>;
  };
  protocol_hint: Record<Band, Record<string, { n: number; success_rate: number }>>;
  input_ranges: Record<
    string,
    { min: number; max: number; p05: number; p95: number; median: number }
  >;
  display: {
    success_by_protocol: { group: string; n: number; success_rate: number }[];
    top_predictors: { variable: string; auc: number }[];
    group_labels: Record<string, string>;
  };
  disclaimer: string;
}

export type Band = "Low" | "Intermediate" | "High";
export const BANDS: Band[] = ["Low", "Intermediate", "High"];

export const MODEL = raw as FinalModel;

/** Clinical reference intervals + input-widget hints. Presentation only. */
export const FIELD_UI: Record<
  string,
  { short: string; unit: string; ref: string; step: number }
> = {
  BUN_mg_dL: { short: "Blood urea nitrogen", unit: "mg/dL", ref: "canine ref ≈ 7–27", step: 1 },
  Creatinine_mg_dL: { short: "Creatinine", unit: "mg/dL", ref: "canine ref ≈ 0.5–1.5", step: 0.1 },
  Albumin_g_dL: { short: "Albumin", unit: "g/dL", ref: "canine ref ≈ 2.6–4.0", step: 0.1 },
  ALP_U_L: { short: "Alkaline phosphatase", unit: "U/L", ref: "canine ref ≈ 20–150", step: 5 },
  Age_years: { short: "Age", unit: "yr", ref: "cohort 3–10", step: 0.5 },
  Illness_Duration_days: { short: "Illness duration", unit: "d", ref: "cohort 2–11", step: 1 },
};

/** Display names for any variable that can appear in the study charts. */
export const NICE_NAME: Record<string, string> = {
  BUN_mg_dL: "Blood urea nitrogen",
  Creatinine_mg_dL: "Creatinine",
  Albumin_g_dL: "Albumin",
  ALP_U_L: "Alkaline phosphatase",
  ALT_U_L: "Alanine aminotransferase",
  Age_years: "Age",
  Illness_Duration_days: "Illness duration",
  Total_Protein_g_dL: "Total protein",
  Globulin_g_dL: "Globulin",
  Uterine_Diameter_mm: "Uterine diameter",
  TLC_per_uL: "Total leukocyte count",
  Neutrophils_per_uL: "Neutrophils",
  Clinical_VAS_0_10: "Clinical severity (VAS)",
};

/** Two worked examples, within the cohort ranges. Marked as examples in the UI. */
export const EXAMPLES: Record<"low" | "high", { label: string; values: Record<string, number> }> = {
  low: {
    label: "Low-risk example",
    values: {
      BUN_mg_dL: 19,
      Creatinine_mg_dL: 0.9,
      Albumin_g_dL: 3.1,
      ALP_U_L: 270,
      Age_years: 4,
      Illness_Duration_days: 3,
    },
  },
  high: {
    label: "High-risk example",
    values: {
      BUN_mg_dL: 33,
      Creatinine_mg_dL: 1.5,
      Albumin_g_dL: 2.2,
      ALP_U_L: 430,
      Age_years: 8.5,
      Illness_Duration_days: 9,
    },
  },
};

export const groupLabel = (g: string): string => MODEL.display.group_labels[g] ?? g;
