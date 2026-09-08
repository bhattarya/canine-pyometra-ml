"""Roadmap step 9 — treatment-outcome prediction.

Cohort : all 80 dogs, G1-G4, treatment Group RETAINED as a predictor.
Target : Treatment_Success_D14 (1 = success).
Note   : G4 (OHE) is perfectly separated (20/20 success). We therefore
         (a) model the full cohort with penalised estimators, and
         (b) run a G1-G3-only sensitivity model.
Workflow: Stage A all predictors -> Stage B LR screen -> Stage C RFECV,
mirroring 04.
"""
from __future__ import annotations
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.experiment import run_stage, univariate_screen, rfecv_select
from pyo.evaluate import save_table

pd.set_option("display.width", 220); pd.set_option("display.max_columns", 80)

df = D.primary_frame()
# model SUCCESS directly (1 = success); event rate for the minority (failure) = 17.5%
TARGET = C.TARGET_PRIMARY
NUM_ALL = C.BASELINE_ALL
CAT = ["Group"]
print(f"n={len(df)}  success={int(df[TARGET].sum())}  failure={int((1-df[TARGET]).sum())}")
print("Group x success:\n", pd.crosstab(df.Group, df[TARGET]))

# ---------- Stage A ---------- #
A = run_stage("05A_treat_all", df, NUM_ALL, CAT, TARGET)

# ---------- Stage B : screen (continuous only; Group forced in) ---------- #
scr, keep_B = univariate_screen(df, NUM_ALL, TARGET, screen_p=0.20)
scr.to_csv(C.TABDIR / "05_univariate_screen.csv", index=False)
print("\nUnivariate screen (p<0.20 kept):"); print(scr.round(4).to_string(index=False))
print("kept:", keep_B)
B = run_stage("05B_treat_screened", df, keep_B, CAT, TARGET)

# ---------- Stage C : RFECV ---------- #
chosen, orig_num, n_feat = rfecv_select(df, NUM_ALL, CAT, TARGET, min_features=3)
orig_num = [c for c in orig_num if c != "Group"]
print(f"\nRFECV selected {n_feat} -> {chosen}")
Cst = run_stage("05C_treat_rfecv", df, orig_num, CAT, TARGET)

# ---------- Sensitivity : G1-G3 only, drop Group ---------- #
sub = df[df.Group.isin(C.MEDICAL_GROUPS)].reset_index(drop=True)
print(f"\n[Sensitivity] G1-G3 only  n={len(sub)}  "
      f"failure={int((1-sub[TARGET]).sum())}")
S = run_stage("05S_treat_G1G3_noGroup", sub, keep_B, None, TARGET)

# ---------- progression summary ---------- #
prog = pd.DataFrame({
    "stage": ["A_all+Group", "B_screened+Group", "C_rfecv+Group", "Sens_G1G3_noGroup"],
    "n_predictors": [len(NUM_ALL) + 1, len(keep_B) + 1, len(orig_num) + 1, len(keep_B)],
    "best_model": [x["best"]["model"] for x in (A, B, Cst, S)],
    "best_resampling": [x["best"]["resampling"] for x in (A, B, Cst, S)],
    "best_ROC_AUC": [x["best"]["ROC_AUC"] for x in (A, B, Cst, S)],
    "best_PR_AUC": [x["best"]["PR_AUC"] for x in (A, B, Cst, S)],
})
save_table(prog, "05_stage_progression.csv")
print("\n=== TREATMENT-OUTCOME MODEL — stage progression ===")
print(prog.to_string(index=False))
