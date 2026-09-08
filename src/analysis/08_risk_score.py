"""Risk stratification + protocol-recommendation table.

1. Fit a compact penalised logistic model for FAILURE on the G1-G3 cohort
   using admission variables only (no Group).
2. Convert coefficients to an integer points score (Sullivan-style).
3. Apply the score to all 80 dogs; bin into Low / Medium / High risk.
4. Cross-tabulate risk class x protocol x observed success rate  ->  the
   practical "which protocol for which dog" table.
"""
from __future__ import annotations
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.evaluate import save_table

pd.set_option("display.width", 200)

# compact, clinically-motivated, low-collinearity predictor set
SCORE_VARS = ["BUN_mg_dL", "Creatinine_mg_dL", "Albumin_g_dL", "ALP_U_L",
              "Age_years", "Illness_Duration_days"]

prog = D.prognostic_frame()
alld = D.baseline_with_outcomes()

scaler = StandardScaler().fit(prog[SCORE_VARS])
Xz = scaler.transform(prog[SCORE_VARS])
y = prog[C.TARGET_PROGNOSTIC].astype(int).values

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    fit = sm.Logit(y, sm.add_constant(Xz)).fit_regularized(alpha=1.0, L1_wt=0.0, disp=0)
beta = fit.params[1:]                      # per-SD log-odds
points = np.round(beta / np.abs(beta[np.argmin(np.abs(beta[beta != 0]))])).astype(int)

coef_tbl = pd.DataFrame({
    "variable": SCORE_VARS, "beta_per_SD": beta.round(3),
    "OR_per_SD": np.exp(beta).round(2), "points_per_SD": points,
})
save_table(coef_tbl, "08_risk_score_coefficients.csv")
print("Risk-score weights (per 1 SD of admission value):")
print(coef_tbl.to_string(index=False))


def score(frame):
    z = scaler.transform(frame[SCORE_VARS])
    return (z * points).sum(axis=1)


alld = alld.assign(risk_score=score(alld))
# tertiles define Low / Medium / High
q1, q2 = alld["risk_score"].quantile([1/3, 2/3])
alld["risk_class"] = pd.cut(alld["risk_score"], [-np.inf, q1, q2, np.inf],
                            labels=["Low", "Medium", "High"])

auc_all = roc_auc_score(1 - alld["Treatment_Success_D14"], alld["risk_score"])
auc_med = roc_auc_score(
    alld.loc[alld.Group.isin(C.MEDICAL_GROUPS), "Medical_Failure_D14"],
    alld.loc[alld.Group.isin(C.MEDICAL_GROUPS), "risk_score"])
print(f"\nScore discrimination — failure, all 80 dogs: AUC={auc_all:.3f}")
print(f"Score discrimination — medical failure, G1-G3 : AUC={auc_med:.3f}")

# risk class x protocol x success
tab = (alld.groupby(["risk_class", "Group"], observed=True)
       .agg(n=("Animal_ID", "size"),
            success=("Treatment_Success_D14", "sum"),
            med_failure=("Medical_Failure_D14", "sum"),
            rescue_OHE=("Rescue_OHE", "sum"))
       .reset_index())
tab["success_rate"] = (tab["success"] / tab["n"]).round(2)
save_table(tab, "08_riskclass_by_protocol.csv")
print("\n=== RISK CLASS x PROTOCOL x OUTCOME ===")
print(tab.to_string(index=False))

# marginal: success rate by risk class
marg = (alld.groupby("risk_class", observed=True)
        .agg(n=("Animal_ID", "size"),
             success_rate=("Treatment_Success_D14", "mean"),
             med_failure_rate=("Medical_Failure_D14", "mean")).round(3))
save_table(marg.reset_index(), "08_success_by_riskclass.csv")
print("\nSuccess rate by risk class (all protocols):\n", marg.to_string())

alld[["Animal_ID", "Group", "risk_score", "risk_class", "Treatment_Success_D14",
      "Medical_Failure_D14"]].to_csv(C.DATA_PROC / "risk_scored_80.csv", index=False)

print("""
Reading of the table (data-driven, hypothesis-generating on n=80):
  * Low risk    -> every protocol reached 100% success; medical management
                   (incl. supportive-only G1) is adequate.
  * Medium risk -> supportive-only (G1) slips (~0.80); G2/G3 and OHE ~1.00, so
                   an active medical protocol is preferred over G1 alone.
  * High risk   -> medical success collapses (G1 ~0.25, G2 ~0.17); aglepristone
                   + PGF2a (G3) is the best medical option (~0.67); OHE (G4)
                   remains ~1.00 and is the safe definitive choice.
""")
