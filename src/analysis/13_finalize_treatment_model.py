"""Lock the deployable TREATMENT-SUCCESS model and export it as plain JSON.

Task (chosen by the user): the clinician selects an intended protocol (G1-G4)
and enters admission values; the model returns P(treatment success by day 14)
for that protocol.

Model: L2-penalised logistic regression on all 80 dogs.
  target   = Treatment_Success_D14 (1 = success)
  numeric  = age, illness duration, heart rate, TLC, creatinine, albumin, ALP,
             uterine diameter, clinical VAS   (9, standardised)
  protocol = Group, one-hot with G1_Supportive as the reference level

Note: G4 (OHE) is perfectly separated in the cohort (20/20 success). The L2
penalty keeps its coefficient finite but its estimate is effectively a fixed
~99% — surfaced with a caveat in the UI.

Writes models/final_model.json (same path the frontend + predict_case.py read).
"""
from __future__ import annotations
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.base import clone
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D

NUMERIC = [
    "Age_years", "Illness_Duration_days", "Heart_Rate_bpm", "TLC_per_uL",
    "Creatinine_mg_dL", "Albumin_g_dL", "ALP_U_L", "Uterine_Diameter_mm",
    "Clinical_VAS_0_10",
]
GROUPS = ["G1_Supportive", "G2_PGF2a", "G3_Aglepristone_PGF2a", "G4_OHE"]
REF = "G1_Supportive"
DUMMIES = [g for g in GROUPS if g != REF]

LABELS = {
    "Age_years": "Age",
    "Illness_Duration_days": "Illness duration",
    "Heart_Rate_bpm": "Heart rate",
    "TLC_per_uL": "Total leucocyte count",
    "Creatinine_mg_dL": "Serum creatinine",
    "Albumin_g_dL": "Serum albumin",
    "ALP_U_L": "Alkaline phosphatase (ALP)",
    "Uterine_Diameter_mm": "Uterine diameter",
    "Clinical_VAS_0_10": "Clinical severity (VAS 0-10)",
}
UNITS = {
    "Age_years": "years", "Illness_Duration_days": "days", "Heart_Rate_bpm": "bpm",
    "TLC_per_uL": "x10^3/uL", "Creatinine_mg_dL": "mg/dL", "Albumin_g_dL": "g/dL",
    "ALP_U_L": "U/L", "Uterine_Diameter_mm": "mm", "Clinical_VAS_0_10": "0-10",
}
REF_RANGES = {
    "Age_years": "cohort 3-10", "Illness_Duration_days": "cohort 2-11",
    "Heart_Rate_bpm": "canine ref ~ 70-120", "TLC_per_uL": "canine ref ~ 6-17",
    "Creatinine_mg_dL": "canine ref ~ 0.5-1.5", "Albumin_g_dL": "canine ref ~ 2.6-4.0",
    "ALP_U_L": "canine ref ~ 20-150", "Uterine_Diameter_mm": "cohort 10-25",
    "Clinical_VAS_0_10": "0 = well, 10 = critical",
}
GROUP_LABELS = {
    "G1_Supportive": "G1 - supportive / antibiotic",
    "G2_PGF2a": "G2 - cloprostenol (PGF2a)",
    "G3_Aglepristone_PGF2a": "G3 - aglepristone + cloprostenol",
    "G4_OHE": "G4 - ovariohysterectomy (surgery)",
}
STEP = {
    "Age_years": 0.5, "Illness_Duration_days": 1, "Heart_Rate_bpm": 1,
    "TLC_per_uL": 0.5, "Creatinine_mg_dL": 0.1, "Albumin_g_dL": 0.1,
    "ALP_U_L": 5, "Uterine_Diameter_mm": 1, "Clinical_VAS_0_10": 0.5,
}

df = D.primary_frame().copy()
y = df["Treatment_Success_D14"].astype(int).values  # 1 = success

mu = df[NUMERIC].mean().values
sd = df[NUMERIC].std(ddof=0).values
Znum = (df[NUMERIC].values - mu) / sd
Gd = np.column_stack([(df["Group"] == g).astype(float).values for g in DUMMIES])
X = np.hstack([Znum, Gd])
cols = NUMERIC + DUMMIES

clf = LogisticRegression(C=0.5, class_weight="balanced", max_iter=5000)
clf.fit(X, y)

# honest internal performance
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=C.SEED)
fold_auc = []
for tr, te in cv.split(X, y):
    p = clone(clf).fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    fold_auc.append(roc_auc_score(y[te], p))
auc_cv, auc_sd = float(np.mean(fold_auc)), float(np.std(fold_auc))
auc_app = roc_auc_score(y, clf.predict_proba(X)[:, 1])

coef = clf.coef_.ravel()
numeric_coef = coef[: len(NUMERIC)].tolist()
group_coef = {REF: 0.0}
for g, b in zip(DUMMIES, coef[len(NUMERIC):]):
    group_coef[g] = float(b)
intercept = float(clf.intercept_[0])

# observed success per protocol
protocol_observed = {
    g: {
        "n": int((df["Group"] == g).sum()),
        "success_rate": round(float(df.loc[df["Group"] == g, "Treatment_Success_D14"].mean()), 3),
    }
    for g in GROUPS
}

# plausible input ranges for the form (from the 80-dog cohort)
input_ranges = {
    f: {
        "min": float(df[f].min()), "max": float(df[f].max()),
        "p05": float(df[f].quantile(0.05)), "p95": float(df[f].quantile(0.95)),
        "median": float(df[f].median()),
    }
    for f in NUMERIC
}

# P(success) label bands + observed success within each predicted band
p_all = clf.predict_proba(X)[:, 1]
LO, HI = 0.50, 0.85
import pandas as pd  # noqa: E402
band = pd.cut(p_all, [-np.inf, LO, HI, np.inf], labels=["Unlikely", "Uncertain", "Likely"])
band_tbl = {
    str(b): {
        "n": int((band == b).sum()),
        "observed_success_rate": round(float(y[band == b].mean()), 3) if (band == b).any() else None,
    }
    for b in ["Unlikely", "Uncertain", "Likely"]
}

# top univariate predictors (magnitude is symmetric for success vs failure)
t2 = C.TABDIR / "02_table2_baseline_by_outcome.csv"
top_predictors = []
if t2.exists():
    tt = pd.read_csv(t2).sort_values("univ_AUC_fail", ascending=False).head(7)
    top_predictors = [
        {"variable": r["variable"], "auc": round(float(r["univ_AUC_fail"]), 3)}
        for _, r in tt.iterrows()
    ]

model = {
    "task": "treatment_success",
    "name": "Canine pyometra - treatment-success predictor (day 14)",
    "generated": date.today().isoformat(),
    "outcome": "Predicted probability that the selected treatment protocol achieves "
               "an uncomplicated resolution by day 14.",
    "cohort": "All 80 dogs, four protocols x 20, followed to day 14 "
              "(66 successes / 14 failures).",
    "numeric_features": NUMERIC,
    "labels": LABELS,
    "units": UNITS,
    "ref_ranges": REF_RANGES,
    "step": STEP,
    "standardisation": {"mean": mu.tolist(), "std": sd.tolist()},
    "numeric_coef": numeric_coef,
    "groups": GROUPS,
    "group_labels": GROUP_LABELS,
    "group_reference": REF,
    "group_coef": group_coef,
    "intercept": intercept,
    "performance": {
        "roc_auc_cv": round(auc_cv, 3),
        "roc_auc_cv_sd": round(auc_sd, 3),
        "roc_auc_apparent": round(float(auc_app), 3),
        "cv": "repeated stratified 5-fold, 20 repeats",
    },
    "success_bands": {"cutpoints_prob": [LO, HI], "table": band_tbl},
    "protocol_observed": protocol_observed,
    "input_ranges": input_ranges,
    "display": {
        "success_by_protocol": [
            {"group": g, "n": protocol_observed[g]["n"],
             "success_rate": protocol_observed[g]["success_rate"]}
            for g in GROUPS
        ],
        "top_predictors": top_predictors,
    },
    "g4_caveat": "G4 (surgery) was not randomised and every study dog treated "
                 "surgically resolved (20/20). Its estimate is effectively a fixed "
                 "~99% and should be read as 'surgery resolved all cohort cases', "
                 "not a calibrated probability.",
    "disclaimer": "Decision-support estimate from a small single-centre teaching "
                  "dataset (n=80, 14 failures). Not a validated clinical tool. "
                  "Predictions complement, not replace, clinical judgement.",
}

out = C.ROOT / "models" / "final_model.json"
out.write_text(json.dumps(model, indent=2))
print("wrote", out)
print(f"\nintercept = {intercept:+.4f}")
for f, b in zip(NUMERIC, numeric_coef):
    print(f"  {f:24s} beta/SD toward success = {b:+.4f}")
print("  group (vs G1):")
for g in GROUPS:
    print(f"    {g:26s} {group_coef[g]:+.4f}")
print(f"\nROC-AUC  cv = {auc_cv:.3f} +/- {auc_sd:.3f}   apparent = {auc_app:.3f}")
print("\nObserved success by protocol:")
for g in GROUPS:
    o = protocol_observed[g]
    print(f"  {g:26s} {o['success_rate']:.0%}  (n={o['n']})")
print("\nPredicted-probability bands:")
for b, v in band_tbl.items():
    print(f"  {b:10s} n={v['n']:3d}  observed success {v['observed_success_rate']}")

# quick sanity: predict a few example cases
def predict(vals: dict, group: str) -> float:
    z = [(vals[f] - mu[i]) / sd[i] for i, f in enumerate(NUMERIC)]
    logit = intercept + sum(numeric_coef[i] * z[i] for i in range(len(NUMERIC)))
    logit += group_coef[group]
    return 1 / (1 + np.exp(-logit))

med = {f: float(df[f].median()) for f in NUMERIC}
print("\nExample (median dog):")
for g in GROUPS:
    print(f"  {g:26s} P(success) = {predict(med, g):.2f}")
sick = {**med, "Creatinine_mg_dL": 1.6, "Albumin_g_dL": 2.2, "ALP_U_L": 460,
        "Illness_Duration_days": 9, "Age_years": 9, "Clinical_VAS_0_10": 8}
print("Example (sicker dog):")
for g in GROUPS:
    print(f"  {g:26s} P(success) = {predict(sick, g):.2f}")
