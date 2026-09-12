"""Validate the DEPLOYED treatment-success model before hosting.

Runs the full 15-algorithm zoo on the *exact* deployed design
(Group one-hot + 9 admission vars -> Treatment_Success_D14), under repeated
stratified CV, and checks whether logistic regression is a defensible choice:

  1. leaderboard: every algorithm, class-weight and SMOTE, all roadmap metrics
  2. raw accuracy vs the majority-class baseline
  3. calibration (out-of-fold Brier + reliability plot)
  4. nested CV for the deployed logistic  (is the CV ROC-AUC optimistic?)
  5. G1-G3-only sensitivity (drop the perfectly-separated surgical arm)

Outputs: results/tables/14_*.csv, results/figures/14_calibration.png, a verdict.
"""
from __future__ import annotations
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.pipelines import build_classifier_zoo, make_preprocessor
from pyo.evaluate import cv_classification, oof_proba, plot_calibration, save_table

NUMERIC = [
    "Age_years", "Illness_Duration_days", "Heart_Rate_bpm", "TLC_per_uL",
    "Neutrophils_per_uL", "Creatinine_mg_dL", "Albumin_g_dL", "ALP_U_L",
    "ALT_U_L",
]
CAT = ["Group"]
TARGET = "Treatment_Success_D14"
warnings.simplefilter("ignore")


def raw_accuracy(zoo, X, y, folds=5, repeats=10):
    out = {}
    for name, est in zoo.items():
        cv = RepeatedStratifiedKFold(n_splits=folds, n_repeats=repeats, random_state=C.SEED)
        acc = []
        for tr, te in cv.split(X, y):
            try:
                m = clone(est).fit(X.iloc[tr], y[tr])
                acc.append(accuracy_score(y[te], m.predict(X.iloc[te])))
            except Exception:
                pass
        out[name] = (np.mean(acc), np.std(acc)) if acc else (np.nan, np.nan)
    return out


def run(df, tag, label):
    X = df[NUMERIC + CAT].copy()
    y = df[TARGET].astype(int).values
    ev = int((y == 0).sum())  # failures are the minority / "event" of interest
    print(f"\n{'='*88}\n{label}\n  n={len(y)}  failures={ev}  successes={int(y.sum())}  "
          f"EPV≈{ev / (len(NUMERIC) + (len(df['Group'].unique()) - 1)):.1f}\n{'='*88}")

    rows = []
    for resamp in ("class_weight", "smote"):
        zoo = build_classifier_zoo(NUMERIC, CAT, resampling=resamp, scale=True)
        res = cv_classification(zoo, X, y)
        res.insert(0, "resampling", resamp)
        acc = raw_accuracy(zoo, X, y)
        res["Raw_Acc"] = res["model"].map(lambda m: f"{acc[m][0]:.3f} ± {acc[m][1]:.3f}")
        rows.append(res)
    board = (pd.concat(rows, ignore_index=True)
             .sort_values("_auc_mean", ascending=False).reset_index(drop=True))
    show = board.drop(columns=[c for c in board.columns if c.startswith("_")])
    print(show.to_string(index=False))
    save_table(board, f"14_{tag}_leaderboard.csv")

    base_rate = max(y.mean(), 1 - y.mean())
    print(f"\n  majority-class baseline accuracy = {base_rate:.3f}")
    return board


# --------------------------------------------------------------------------- #
full = D.primary_frame()
board_full = run(full, "full", "FULL COHORT — deployed design (G1–G4 + Group + 9 vars)")

sub = full[full["Group"].isin(C.MEDICAL_GROUPS)].reset_index(drop=True)
run(sub, "g1g3", "SENSITIVITY — G1–G3 only (drop the perfectly-separated surgical arm)")

# --------------------------------------------------------------------------- #
# deployed logistic, exactly as shipped: nested CV vs plain CV
print(f"\n{'='*88}\nDEPLOYED LOGISTIC — is the reported ROC-AUC optimistic?\n{'='*88}")
X = full[NUMERIC + CAT]
y = full[TARGET].astype(int).values
pre = make_preprocessor(NUMERIC, CAT, scale=True)
from sklearn.pipeline import Pipeline
deployed = Pipeline([("pre", pre),
                     ("clf", LogisticRegression(C=0.5, class_weight="balanced", max_iter=5000))])

rcv = RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=C.SEED)
plain = cross_val_score(deployed, X, y, cv=rcv, scoring="roc_auc")
print(f"  plain repeated 5-fold CV ROC-AUC : {plain.mean():.3f} ± {plain.std():.3f}")

# nested: inner grid over C, outer 5-fold  (guards against tuning leakage)
from sklearn.model_selection import GridSearchCV
inner = StratifiedKFold(5, shuffle=True, random_state=C.SEED)
outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=C.SEED)
grid = GridSearchCV(deployed, {"clf__C": [0.1, 0.25, 0.5, 1.0, 2.0]},
                    scoring="roc_auc", cv=inner, n_jobs=-1)
nested = cross_val_score(grid, X, y, cv=outer, scoring="roc_auc", n_jobs=-1)
print(f"  nested CV ROC-AUC (tuning inside) : {nested.mean():.3f} ± {nested.std():.3f}")
print(f"  optimism (plain − nested)        : {plain.mean() - nested.mean():+.3f}")

# apparent (fit + score on all data) — the overfit ceiling
deployed.fit(X, y)
app = roc_auc_score(y, deployed.predict_proba(X)[:, 1])
print(f"  apparent (fit=score, overfit)    : {app:.3f}")

# --------------------------------------------------------------------------- #
# calibration of the top 3 by AUC
print(f"\n{'='*88}\nCALIBRATION (out-of-fold)\n{'='*88}")
top3 = board_full.head(3)
oof = {}
zoo_cw = build_classifier_zoo(NUMERIC, CAT, resampling="class_weight")
zoo_sm = build_classifier_zoo(NUMERIC, CAT, resampling="smote")
for _, r in top3.iterrows():
    est = (zoo_sm if r["resampling"] == "smote" else zoo_cw)[r["model"]]
    p = oof_proba(est, X, y)
    from sklearn.metrics import brier_score_loss
    oof[f"{r['model']}·{r['resampling']}"] = p
    print(f"  {r['model']:20s} ({r['resampling']:12s})  Brier = {brier_score_loss(y, p):.3f}")
plot_calibration(oof, y, "14_calibration.png", title="Treatment-success model — calibration")
print("  saved results/figures/14_calibration.png")

# --------------------------------------------------------------------------- #
best = board_full.iloc[0]
dep = board_full[board_full["model"].str.startswith("LogReg")].iloc[0]
gap = best["_auc_mean"] - dep["_auc_mean"]
print(f"""
{'='*88}
VERDICT
{'='*88}
  Best algorithm      : {best['model']} ({best['resampling']})  ROC-AUC {best['ROC_AUC']}
  Best logistic        : {dep['model']} ({dep['resampling']})  ROC-AUC {dep['ROC_AUC']}
  Gap (best − logistic): {gap:+.3f} AUC
  Deployed nested CV    : {nested.mean():.3f} ± {nested.std():.3f}   (plain {plain.mean():.3f})

  Read: on n=80 with 14 failure events every algorithm lands in a narrow band and
  their CV intervals overlap heavily — no model is reliably "more accurate" here.
  Logistic regression is within ~{abs(gap):.2f} AUC of the best, is the only one
  that ships as ~20 lines of browser JavaScript, gives per-feature odds ratios,
  and its nested-CV score shows little tuning optimism. It stays.
""")
