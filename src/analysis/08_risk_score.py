"""Risk stratification + protocol-recommendation table.

1. Reuse the LOCKED, deployed medical-failure model (models/prognostic_model.json
   — six admission variables, L2-penalised logistic regression fitted on the
   G1-G3 cohort) rather than re-fitting a separate model here, so the risk
   score's weights are numerically identical to the model's own reported
   coefficients (no second, independently-fit model with its own numbers).
2. Convert those coefficients to an integer points score (Sullivan-style).
3. Apply the score to all 80 dogs; bin into Low / Medium / High risk.
4. Cross-tabulate risk class x protocol x observed success rate  ->  the
   practical "which protocol for which dog" table.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D
from pyo.evaluate import save_table

pd.set_option("display.width", 200)

alld = D.baseline_with_outcomes()

# --- reuse the locked, deployed model's own coefficients (not a refit) -----
locked = json.loads((C.ROOT / "models" / "prognostic_model.json").read_text())
SCORE_VARS = locked["features"]                       # same 6 vars, same order
mean = np.array(locked["standardisation"]["mean"])
std = np.array(locked["standardisation"]["std"])
beta = np.array(locked["coef"])                       # per-SD log-odds, L2-penalised
points = np.round(beta / np.abs(beta[np.argmin(np.abs(beta[beta != 0]))])).astype(int)

scaler_mean, scaler_std = mean, std  # for score()

coef_tbl = pd.DataFrame({
    "variable": SCORE_VARS, "beta_per_SD": beta.round(3),
    "OR_per_SD": np.exp(beta).round(2), "points_per_SD": points,
})
save_table(coef_tbl, "08_risk_score_coefficients.csv")
print("Risk-score weights (per 1 SD of admission value):")
print(coef_tbl.to_string(index=False))


def score(frame):
    z = (frame[SCORE_VARS].values - scaler_mean) / scaler_std
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
