"""Roadmap steps 5-8 — prognostic ML.

Cohort : G1-G3 (n=60), admission predictors only, NO treatment group.
Target : Medical_Failure_D14 (1 = medical management failed by day 14).
Workflow: Stage A all predictors -> Stage B LR screen -> Stage C RFECV.
"""
from __future__ import annotations
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.experiment import run_stage, univariate_screen, rfecv_select
from pyo.evaluate import save_table

pd.set_option("display.width", 220); pd.set_option("display.max_columns", 80)

df = D.prognostic_frame()
TARGET = C.TARGET_PROGNOSTIC
NUM_ALL = C.BASELINE_ALL                       # 19 continuous admission predictors
print(f"n={len(df)}  events={int(df[TARGET].sum())}  predictors={len(NUM_ALL)}")

# ----- Stage A : everything ------------------------------------------------- #
A = run_stage("04A_prognostic_all", df, NUM_ALL, None, TARGET)

# ----- Stage B : univariate logistic screen ------------------------------- #
scr, keep_B = univariate_screen(df, NUM_ALL, TARGET, screen_p=0.20)
scr.to_csv(C.TABDIR / "04_univariate_screen.csv", index=False)
print("\nUnivariate screen (p<0.20 kept):")
print(scr.round(4).to_string(index=False))
print("kept:", keep_B)
B = run_stage("04B_prognostic_screened", df, keep_B, None, TARGET)

# ----- Stage C : RFECV --------------------------------------------------- #
chosen, orig, n_feat = rfecv_select(df, NUM_ALL, None, TARGET, min_features=3)
print(f"\nRFECV selected {n_feat} features -> {orig}")
C_ = run_stage("04C_prognostic_rfecv", df, orig, None, TARGET)

# ----- progression summary --------------------------------------------- #
prog = pd.DataFrame({
    "stage": ["A_all", "B_screened", "C_rfecv"],
    "n_predictors": [len(NUM_ALL), len(keep_B), len(orig)],
    "best_model": [A["best"]["model"], B["best"]["model"], C_["best"]["model"]],
    "best_resampling": [A["best"]["resampling"], B["best"]["resampling"], C_["best"]["resampling"]],
    "best_ROC_AUC": [A["best"]["ROC_AUC"], B["best"]["ROC_AUC"], C_["best"]["ROC_AUC"]],
    "best_PR_AUC": [A["best"]["PR_AUC"], B["best"]["PR_AUC"], C_["best"]["PR_AUC"]],
})
save_table(prog, "04_stage_progression.csv")
print("\n=== PROGNOSTIC MODEL — stage progression ===")
print(prog.to_string(index=False))
