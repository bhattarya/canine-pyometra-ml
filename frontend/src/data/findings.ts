/* ------------------------------------------------------------------ *
 *  Curated findings for the "How the estimate is made" section.
 *
 *  Every value below is copied from a committed artefact under
 *  results/ or models/ (cited per-export). The upstream files are
 *  frozen, so hardcoding the curated numbers here is deliberate — it
 *  keeps the Method section self-contained and avoids reaching into
 *  lib/ or re-parsing CSVs at runtime.
 * ------------------------------------------------------------------ */

/* ==================================================================
 * 1. Algorithm bake-off
 *    Source: results/tables/14_full_leaderboard.csv
 *
 *    Fifteen algorithms scored under repeated stratified 5-fold CV on
 *    the deployed design (80 dogs, 14 failures). We keep the
 *    `class_weight` rows only — the `smote` rows are near-duplicates
 *    and the `QDA` row is FAILED — and show the top 12 by ROC-AUC.
 *    ROC_AUC "0.951 ± 0.093" is split into { mean, sd }.
 *    `deployed` marks the logistic-regression family that ships.
 * ================================================================== */
export interface LeaderboardRow {
  /** display name */
  model: string;
  /** raw leaderboard key (starts "LogReg" for the deployed family) */
  key: string;
  mean: number;
  sd: number;
  deployed: boolean;
}

export const LEADERBOARD: LeaderboardRow[] = [
  { model: "Gaussian NB", key: "GaussianNB", mean: 0.953, sd: 0.09, deployed: false },
  { model: "LDA", key: "LDA", mean: 0.933, sd: 0.067, deployed: false },
  { model: "Random forest", key: "RandomForest", mean: 0.931, sd: 0.053, deployed: false },
  { model: "LogReg (L2)", key: "LogReg_L2", mean: 0.925, sd: 0.075, deployed: true },
  { model: "LogReg (elastic net)", key: "LogReg_ElasticNet", mean: 0.919, sd: 0.077, deployed: true },
  { model: "AdaBoost", key: "AdaBoost", mean: 0.918, sd: 0.074, deployed: false },
  { model: "RBF SVM", key: "RBF_SVM", mean: 0.917, sd: 0.068, deployed: false },
  { model: "LogReg (L1 / LASSO)", key: "LogReg_L1_LASSO", mean: 0.913, sd: 0.087, deployed: true },
  { model: "Linear SVM", key: "LinearSVM", mean: 0.91, sd: 0.081, deployed: false },
  { model: "Hist gradient boosting", key: "HistGradientBoosting", mean: 0.906, sd: 0.082, deployed: false },
  { model: "KNN", key: "KNN", mean: 0.901, sd: 0.092, deployed: false },
  { model: "Gradient boosting", key: "GradientBoosting", mean: 0.894, sd: 0.077, deployed: false },
];

/** x-domain for the leaderboard bars. */
export const LEADERBOARD_DOMAIN: [number, number] = [0.75, 1.0];

/* ==================================================================
 * 2. CPV-style feature reduction (treatment task)
 *    Source: results/tables/05_stage_progression.csv
 *
 *    best_ROC_AUC "0.955 ± 0.088" is split into { mean, sd }.
 *    Stage C keeps the protocol term plus three admission values.
 * ================================================================== */
export interface StageRow {
  key: string;
  /** short human label for the reduction step */
  label: string;
  nPredictors: number;
  auc: { mean: number; sd: number };
}

export const STAGE_REDUCTION: StageRow[] = [
  { key: "A_all+Group", label: "All variables", nPredictors: 20, auc: { mean: 0.955, sd: 0.088 } },
  { key: "B_screened+Group", label: "Univariate screen", nPredictors: 11, auc: { mean: 0.96, sd: 0.088 } },
  { key: "C_rfecv+Group", label: "Recursive elimination", nPredictors: 4, auc: { mean: 0.972, sd: 0.037 } },
];

/** Sensitivity fit: medical arms G1 + G3 only, protocol term dropped. */
export const STAGE_SENSITIVITY: StageRow = {
  key: "Sens_G1G3_noGroup",
  label: "G1/G3 only, no protocol term",
  nPredictors: 10,
  auc: { mean: 0.947, sd: 0.08 },
};

/* ==================================================================
 * 3. How the predicted bands played out
 *    Source: models/final_model.json -> success_bands.table
 *    (cutpoints 0.50 / 0.85 on predicted probability)
 * ================================================================== */
export type BandName = "Unlikely" | "Uncertain" | "Likely";

export interface BandRow {
  band: BandName;
  n: number;
  observedSuccessRate: number;
  tone: "poor" | "warn" | "good";
}

export const BAND_CALIBRATION: BandRow[] = [
  { band: "Unlikely", n: 21, observedSuccessRate: 0.333, tone: "poor" },
  { band: "Uncertain", n: 18, observedSuccessRate: 1.0, tone: "warn" },
  { band: "Likely", n: 41, observedSuccessRate: 1.0, tone: "good" },
];

/** Probability cutpoints for the three bands (final_model.json -> success_bands.cutpoints_prob). */
export const BAND_CUTPOINTS: [number, number] = [0.5, 0.85];

/* ==================================================================
 * 4a. Standardised logistic-regression coefficients (admission values)
 *     Source: models/final_model.json -> numeric_features / numeric_coef
 *     Units: log-odds toward success per +1 SD, everything else fixed.
 *     Human labels from final_model.json -> labels.
 *     Sorted by |coef| descending.
 * ================================================================== */
export interface EffectRow {
  label: string;
  coef: number;
}

export const FEATURE_EFFECTS: EffectRow[] = [
  { label: "Alkaline phosphatase (ALP)", coef: -1.0105 },
  { label: "Serum albumin", coef: 0.8267 },
  { label: "Serum creatinine", coef: -0.7023 },
  { label: "Age", coef: -0.6402 },
  { label: "Alanine aminotransferase (ALT)", coef: -0.3036 },
  { label: "Heart rate", coef: -0.2095 },
  { label: "Illness duration", coef: -0.1898 },
  { label: "Neutrophil count", coef: -0.1546 },
  { label: "Total leucocyte count", coef: 0.0115 },
];

/* ==================================================================
 * 4b. Protocol effect vs the G1 reference
 *     Source: models/final_model.json -> group_coef / group_labels
 *     group_reference = "G1_Supportive" (coef 0). Same log-odds scale
 *     as the admission-value coefficients above.
 * ================================================================== */
export const PROTOCOL_EFFECTS: EffectRow[] = [
  { label: "G2 – cloprostenol (PGF2a)", coef: -0.1259 },
  { label: "G3 – aglepristone + cloprostenol", coef: 0.5748 },
  { label: "G4 – ovariohysterectomy (surgery)", coef: 1.2334 },
];

/* ==================================================================
 * 5. Observed day-14 resolution by protocol (all 80 dogs)
 *    Source: models/final_model.json -> display.success_by_protocol
 *    (+ group_labels for the display names)
 * ================================================================== */
export interface RateRow {
  label: string;
  value: number;
  n: number;
}

export const SUCCESS_BY_PROTOCOL: RateRow[] = [
  { label: "G1 – supportive / antibiotic", value: 0.65, n: 20 },
  { label: "G2 – cloprostenol (PGF2a)", value: 0.75, n: 20 },
  { label: "G3 – aglepristone + cloprostenol", value: 0.9, n: 20 },
  { label: "G4 – ovariohysterectomy (surgery)", value: 1.0, n: 20 },
];

/* ==================================================================
 * 6. Strongest single admission predictors (univariate AUC)
 *    Source: models/final_model.json -> display.top_predictors
 * ================================================================== */
export const TOP_PREDICTORS: { label: string; auc: number }[] = [
  { label: "Blood urea nitrogen", auc: 0.891 },
  { label: "Serum creatinine", auc: 0.89 },
  { label: "Serum albumin", auc: 0.837 },
  { label: "Alanine aminotransferase", auc: 0.835 },
  { label: "Alkaline phosphatase (ALP)", auc: 0.831 },
  { label: "Illness duration", auc: 0.735 },
  { label: "Age", auc: 0.733 },
];

/* ==================================================================
 * 7. Held-out discrimination
 *    Source: models/final_model.json -> performance (treatment model)
 *            models/prognostic_model.json -> performance (failure model)
 *    Both: repeated stratified 5-fold CV, 20 repeats.
 * ================================================================== */
export const TREATMENT_PERF = { rocAucCv: 0.905, rocAucCvSd: 0.079 };
export const PROGNOSTIC_PERF = { rocAucCv: 0.948, rocAucCvSd: 0.066 };

/* ==================================================================
 * 8. Classification metrics at the 0.5 decision threshold
 *    Source: models/final_model.json -> performance
 *    Same repeated stratified 5-fold CV (20 repeats) as the AUC above.
 *    Sensitivity = recall on the success class; specificity = recall
 *    on the failure class.
 * ================================================================== */
export interface MetricRow {
  key: string;
  label: string;
  mean: number;
  sd: number;
  /** true for a 0-1 rate formatted as a percentage */
  pct: boolean;
}

export const TREATMENT_METRICS: MetricRow[] = [
  { key: "auc", label: "ROC-AUC", mean: 0.905, sd: 0.079, pct: false },
  { key: "accuracy", label: "Accuracy", mean: 0.846, sd: 0.076, pct: true },
  { key: "sensitivity", label: "Sensitivity", mean: 0.871, sd: 0.08, pct: true },
  { key: "specificity", label: "Specificity", mean: 0.722, sd: 0.285, pct: true },
  { key: "f1", label: "F1 score", mean: 0.902, sd: 0.05, pct: false },
];

/**
 * ROC curve from one clean 5-fold out-of-fold pass (every dog scored by a
 * fold that never trained on it). Source: models/final_model.json ->
 * performance.roc_curve.
 */
export const ROC_CURVE: { fpr: number; tpr: number }[] = [
  { fpr: 0, tpr: 0 },
  { fpr: 0, tpr: 0.0152 },
  { fpr: 0, tpr: 0.6364 },
  { fpr: 0.0714, tpr: 0.6364 },
  { fpr: 0.0714, tpr: 0.7424 },
  { fpr: 0.1429, tpr: 0.7424 },
  { fpr: 0.1429, tpr: 0.8485 },
  { fpr: 0.2143, tpr: 0.8485 },
  { fpr: 0.2143, tpr: 0.9091 },
  { fpr: 0.3571, tpr: 0.9091 },
  { fpr: 0.3571, tpr: 0.9242 },
  { fpr: 0.4286, tpr: 0.9242 },
  { fpr: 0.4286, tpr: 0.9394 },
  { fpr: 0.5, tpr: 0.9394 },
  { fpr: 0.5, tpr: 0.9697 },
  { fpr: 0.7857, tpr: 0.9697 },
  { fpr: 0.7857, tpr: 0.9848 },
  { fpr: 0.8571, tpr: 0.9848 },
  { fpr: 0.8571, tpr: 1.0 },
  { fpr: 1.0, tpr: 1.0 },
];

/** Cohort one-liner (models/final_model.json -> cohort). */
export const COHORT =
  "All 80 dogs, four protocols × 20, followed to day 14 (66 successes / 14 failures).";
