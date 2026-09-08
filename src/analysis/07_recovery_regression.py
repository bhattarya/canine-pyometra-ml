"""Recovery-time regression (CPV paper's secondary model).

Cohort : dogs with a recorded Days_to_Resolution (n=74).
Target : Days_to_Resolution (continuous).
Models : LinearRegression, DecisionTree, RandomForest, KNN  (repeated KFold CV).
Predictors: baseline pool + Group.
"""
from __future__ import annotations
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.pipelines import build_regressor_zoo
from pyo.evaluate import cv_regression, save_table

pd.set_option("display.width", 200)

df = D.recovery_frame()
TARGET = C.TARGET_REGRESSION
NUM = C.BASELINE_ALL
CAT = ["Group"]
print(f"n={len(df)}   {TARGET}: mean={df[TARGET].mean():.2f}  sd={df[TARGET].std():.2f}"
      f"  range=[{df[TARGET].min():.2f}, {df[TARGET].max():.2f}]")

zoo = build_regressor_zoo(NUM, CAT, scale=True)
res = cv_regression(zoo, df[NUM + CAT], df[TARGET])
save_table(res, "07_recovery_model_comparison.csv")
print("\nRepeated 5-fold CV (days):")
print(res.drop(columns=[c for c in res.columns if c.startswith("_")]).to_string(index=False))

# univariate Spearman / ANOVA screen (paper's approach for the recovery model)
rows = []
for v in NUM:
    rho, p = stats.spearmanr(df[v], df[TARGET])
    rows.append({"predictor": v, "spearman_rho": round(rho, 3), "p_value": round(p, 4)})
for g in [CAT[0]]:
    groups = [x[TARGET].values for _, x in df.groupby(g)]
    f, p = stats.f_oneway(*groups)
    rows.append({"predictor": g, "spearman_rho": np.nan, "p_value": round(p, 4)})
scr = pd.DataFrame(rows).sort_values("p_value")
save_table(scr, "07_recovery_univariate_screen.csv")
print("\nUnivariate association with recovery time:")
print(scr.to_string(index=False))

# mean recovery by group
by_g = df.groupby("Group")[TARGET].agg(["count", "mean", "std"]).round(2)
save_table(by_g.reset_index(), "07_recovery_by_group.csv")
print("\nRecovery time by protocol:\n", by_g.to_string())
