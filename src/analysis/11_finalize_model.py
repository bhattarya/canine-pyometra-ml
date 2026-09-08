"""Lock the final deployable model and export it as plain JSON.

The web predictor and `predict_case.py` both load `models/final_model.json`,
so the browser runs the *same* maths as Python (no server, no sklearn in the
browser).

Final model: L2 logistic regression for MEDICAL FAILURE by day 14, fitted on the
G1-G3 cohort (n=60) using six routine admission variables. Standardisation
stats, coefficients and risk-band cut-points are all written out.
"""
from __future__ import annotations
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D

FEATURES = ["BUN_mg_dL", "Creatinine_mg_dL", "Albumin_g_dL",
            "ALP_U_L", "Age_years", "Illness_Duration_days"]
LABELS = {
    "BUN_mg_dL": "Blood urea nitrogen (mg/dL)",
    "Creatinine_mg_dL": "Creatinine (mg/dL)",
    "Albumin_g_dL": "Albumin (g/dL)",
    "ALP_U_L": "Alkaline phosphatase (U/L)",
    "Age_years": "Age (years)",
    "Illness_Duration_days": "Illness duration (days)",
}

prog = D.prognostic_frame()
alld = D.baseline_with_outcomes()
X = prog[FEATURES].astype(float)
y = prog[C.TARGET_PROGNOSTIC].astype(int).values

mu = X.mean().values
sd = X.std(ddof=0).values
Xz = (X.values - mu) / sd

clf = LogisticRegression(C=1.0, class_weight="balanced", max_iter=5000)  # L2 default
clf.fit(Xz, y)

# honest internal performance — mean held-out AUC over repeated stratified CV
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=C.SEED)
fold_auc = []
for tr, te in cv.split(Xz, y):
    p = clone(clf).fit(Xz[tr], y[tr]).predict_proba(Xz[te])[:, 1]
    fold_auc.append(roc_auc_score(y[te], p))
auc_cv = float(np.mean(fold_auc))
auc_cv_sd = float(np.std(fold_auc))
auc_app = roc_auc_score(y, clf.predict_proba(Xz)[:, 1])

# risk bands: clinically-readable fixed probability cut-points
p_all = clf.predict_proba((alld[FEATURES].astype(float).values - mu) / sd)[:, 1]
alld = alld.assign(p_fail=p_all)
LO_CUT, HI_CUT = 0.10, 0.40
lo, hi = LO_CUT, HI_CUT
band = pd.cut(alld["p_fail"], [-np.inf, lo, hi, np.inf],
              labels=["Low", "Intermediate", "High"])
band_tbl = (alld.assign(band=band)
            .groupby("band", observed=True)
            .agg(n=("Animal_ID", "size"),
                 observed_failure_rate=("Medical_Failure_D14", "mean"),
                 observed_success_rate=("Treatment_Success_D14", "mean")).round(3))

# risk-band x protocol observed success (G1-G4) for the protocol hint
prot = (alld.assign(band=band)
        .groupby(["band", "Group"], observed=True)
        .agg(n=("Animal_ID", "size"),
             success_rate=("Treatment_Success_D14", "mean")).round(2)
        .reset_index())
prot_hint = {b: {r["Group"]: {"n": int(r["n"]), "success_rate": float(r["success_rate"])}
                 for _, r in prot[prot.band == b].iterrows()}
             for b in ["Low", "Intermediate", "High"]}

# plausible input ranges (from the 80-dog cohort) for the form
ranges = {f: {"min": float(alld[f].min()), "max": float(alld[f].max()),
              "p05": float(alld[f].quantile(.05)), "p95": float(alld[f].quantile(.95)),
              "median": float(alld[f].median())} for f in FEATURES}

# ---- display data for the web page, all computed from data/model (no hand values) ----
succ_by_prot = (alld.groupby("Group")["Treatment_Success_D14"]
                .agg(n="size", success_rate="mean").reindex(C.GROUPS).reset_index())
success_by_protocol = [{"group": r["Group"], "n": int(r["n"]),
                        "success_rate": round(float(r["success_rate"]), 3)}
                       for _, r in succ_by_prot.iterrows()]

t2_path = C.TABDIR / "02_table2_baseline_by_outcome.csv"
top_predictors = []
if t2_path.exists():
    t2 = pd.read_csv(t2_path).sort_values("univ_AUC_fail", ascending=False).head(7)
    top_predictors = [{"variable": r["variable"], "auc": round(float(r["univ_AUC_fail"]), 3)}
                      for _, r in t2.iterrows()]

display = {
    "success_by_protocol": success_by_protocol,
    "top_predictors": top_predictors,
    "group_labels": {
        "G1_Supportive": "G1 · supportive",
        "G2_PGF2a": "G2 · PGF2α",
        "G3_Aglepristone_PGF2a": "G3 · aglepristone + PGF2α",
        "G4_OHE": "G4 · ovariohysterectomy",
    },
}

model = {
    "name": "Canine pyometra — medical-failure risk (day 14)",
    "generated": date.today().isoformat(),
    "outcome": "Probability that medical management fails by day 14 "
               "(death, rescue ovariohysterectomy, or non-response).",
    "cohort": "G1-G3 medical-protocol dogs, n=60, 14 failure events.",
    "features": FEATURES,
    "labels": LABELS,
    "standardisation": {"mean": mu.tolist(), "std": sd.tolist()},
    "coef": clf.coef_.ravel().tolist(),
    "intercept": float(clf.intercept_[0]),
    "performance": {
        "roc_auc_cv": round(auc_cv, 3),
        "roc_auc_cv_sd": round(auc_cv_sd, 3),
        "roc_auc_apparent": round(float(auc_app), 3),
        "cv": "repeated stratified 5-fold, 20 repeats",
    },
    "risk_bands": {
        "cutpoints_prob": [round(float(lo), 4), round(float(hi), 4)],
        "table": {b: {"n": int(band_tbl.loc[b, "n"]),
                      "observed_failure_rate": round(float(band_tbl.loc[b, "observed_failure_rate"]), 3),
                      "observed_success_rate": round(float(band_tbl.loc[b, "observed_success_rate"]), 3)}
                  for b in band_tbl.index},
    },
    "protocol_hint": prot_hint,
    "input_ranges": ranges,
    "display": display,
    "disclaimer": "Decision-support estimate from a small single-centre teaching "
                  "dataset (n=80). Not a validated clinical tool. The treating "
                  "clinician's judgement takes precedence.",
}

out = C.ROOT / "models" / "final_model.json"
out.write_text(json.dumps(model, indent=2))
print("wrote", out)
print(f"\nfeatures: {FEATURES}")
print(f"intercept={model['intercept']:.4f}")
for f, b in zip(FEATURES, model["coef"]):
    print(f"  {f:22s} beta(per SD) = {b:+.4f}")
print(f"\nROC-AUC  cv={auc_cv:.3f}   apparent={auc_app:.3f}")
print("\nRisk bands (prob cut-points {}):".format(model["risk_bands"]["cutpoints_prob"]))
print(band_tbl.to_string())
print("\nProtocol hint (observed success rate by band x protocol):")
print(prot.to_string(index=False))
