"""Roadmap step 10 — missing-data strategy comparison.

The workbook's ML_missing_5pct sheet is the G1-G3 cohort with ~5% of cells
blanked (MCAR).  We have the complete truth in the prognostic frame, so we can
score each imputer two ways:
  1. imputation accuracy  (RMSE vs the true value, standardised)
  2. downstream task AUC   (prognostic model, repeated stratified CV)
"""
from __future__ import annotations
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.experimental import enable_iterative_imputer  # noqa: F401
from sklearn.impute import SimpleImputer, KNNImputer, IterativeImputer
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.pipelines import build_classifier_zoo
from pyo.evaluate import cv_classification, save_table

pd.set_option("display.width", 200)

TARGET = C.TARGET_PROGNOSTIC
PRED = C.BASELINE_ALL

truth = D.prognostic_frame().set_index("Animal_ID")
miss = D.missing_practice_frame().set_index("Animal_ID")
miss = miss.reindex(truth.index)
PRED = [c for c in PRED if c in miss.columns]

mask = miss[PRED].isna()
print(f"n={len(miss)}  cells blanked: {int(mask.values.sum())} "
      f"({mask.values.mean()*100:.1f}%)  cols affected: {int(mask.any().sum())}")

# standardise on truth scale for a fair RMSE
scaler = StandardScaler().fit(truth[PRED])
truth_z = pd.DataFrame(scaler.transform(truth[PRED]), index=truth.index, columns=PRED)

IMPUTERS = {
    "median": SimpleImputer(strategy="median"),
    "mean": SimpleImputer(strategy="mean"),
    "knn5": KNNImputer(n_neighbors=5),
    "iterative": IterativeImputer(random_state=C.SEED, max_iter=25, sample_posterior=False),
}

acc_rows, auc_rows = [], []
for name, imp in IMPUTERS.items():
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        filled = pd.DataFrame(imp.fit_transform(miss[PRED]), index=miss.index, columns=PRED)
    filled_z = pd.DataFrame(scaler.transform(filled), index=filled.index, columns=PRED)
    err = (filled_z.values - truth_z.values)[mask.values]
    acc_rows.append({"imputer": name, "imputed_cells": int(mask.values.sum()),
                     "RMSE_z": float(np.sqrt(np.mean(err ** 2))),
                     "MAE_z": float(np.mean(np.abs(err)))})

    Xy = filled.copy()
    Xy[TARGET] = truth[TARGET].values
    zoo = build_classifier_zoo(PRED, None, resampling="class_weight", scale=True)
    cvres = cv_classification({k: zoo[k] for k in
                               ["LogReg_L1_LASSO", "RandomForest", "GradientBoosting"]},
                              Xy[PRED], Xy[TARGET].astype(int))
    for _, r in cvres.iterrows():
        auc_rows.append({"imputer": name, "model": r["model"],
                         "ROC_AUC": r["ROC_AUC"], "PR_AUC": r["PR_AUC"]})

acc = pd.DataFrame(acc_rows).sort_values("RMSE_z")
auc = pd.DataFrame(auc_rows)
save_table(acc, "06_imputation_accuracy.csv")
save_table(auc, "06_imputation_downstream_auc.csv")
print("\nImputation accuracy (standardised, lower = better):")
print(acc.to_string(index=False))
print("\nDownstream prognostic-model AUC by imputer:")
print(auc.to_string(index=False))
