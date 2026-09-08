"""Roadmap step 2 — descriptives & baseline group comparisons.

  * Table 1: baseline characteristics by treatment arm
  * Table 2: baseline characteristics by D14 outcome (success vs failure) + tests
  * Univariate screening: per-predictor AUC / Mann-Whitney / standardised diff
Outputs: results/tables/02_*.csv
"""
from __future__ import annotations
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 80)
pd.set_option("display.max_rows", 120)
TAB = C.TABDIR

base = D.baseline_with_outcomes()
NUM = C.BASELINE_ALL
FLAGS = C.RISK_FLAGS


def fmt_msd(s):
    return f"{s.mean():.2f} ± {s.std():.2f}"


def hedges_g(a, b):
    na, nb = len(a), len(b)
    sp = np.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1)) / (na + nb - 2))
    d = (a.mean() - b.mean()) / sp if sp else np.nan
    J = 1 - 3 / (4 * (na + nb) - 9)
    return d * J


# ------------------------------------------------------------------ Table 1
rows = []
for v in NUM:
    r = {"variable": v}
    for g in C.GROUPS:
        r[g] = fmt_msd(base.loc[base.Group == g, v])
    groups = [base.loc[base.Group == g, v] for g in C.GROUPS]
    r["ANOVA_p"] = round(stats.f_oneway(*groups).pvalue, 3)
    rows.append(r)
t1 = pd.DataFrame(rows)
t1.to_csv(TAB / "02_table1_baseline_by_arm.csv", index=False)
print("TABLE 1 — baseline by arm\n", t1.to_string(index=False))

# ------------------------------------------------------------------ Table 2
succ = base["Treatment_Success_D14"] == 1
rows = []
for v in NUM:
    a = base.loc[~succ, v]   # failures
    b = base.loc[succ, v]    # successes
    U, p_mw = stats.mannwhitneyu(a, b, alternative="two-sided")
    t, p_t = stats.ttest_ind(a, b, equal_var=False)
    try:
        auc = roc_auc_score(~succ, base[v])   # AUC for predicting FAILURE
        auc = max(auc, 1 - auc)
    except Exception:
        auc = np.nan
    rows.append({
        "variable": v,
        "failure_mean_sd": fmt_msd(a), "success_mean_sd": fmt_msd(b),
        "hedges_g": round(hedges_g(a, b), 2),
        "univ_AUC_fail": round(auc, 3),
        "mannwhitney_p": round(p_mw, 4), "welch_t_p": round(p_t, 4),
    })
t2 = (pd.DataFrame(rows).sort_values("univ_AUC_fail", ascending=False)
      .reset_index(drop=True))
t2.to_csv(TAB / "02_table2_baseline_by_outcome.csv", index=False)
print("\nTABLE 2 — baseline by D14 outcome (ranked by univariate AUC for failure)\n",
      t2.to_string(index=False))

# ------------------------------------------------------------------ flags vs outcome
rows = []
for f in FLAGS:
    ct = pd.crosstab(base[f], ~succ)
    chi2, p, *_ = stats.chi2_contingency(ct)
    # failure rate by flag level
    fr1 = base.loc[base[f] == 1, "Medical_Failure_D14"].mean()
    fr0 = base.loc[base[f] == 0, "Medical_Failure_D14"].mean()
    rows.append({"flag": f, "n_flag_pos": int(base[f].sum()),
                 "fail_rate_flag1": round(fr1, 3), "fail_rate_flag0": round(fr0, 3),
                 "risk_diff": round(fr1 - fr0, 3), "chi2_p": round(p, 4)})
tf = pd.DataFrame(rows).sort_values("risk_diff", ascending=False)
tf.to_csv(TAB / "02_risk_flags_vs_outcome.csv", index=False)
print("\nRISK FLAGS vs failure\n", tf.to_string(index=False))

# ------------------------------------------------------------------ correlation
corr = base[NUM].corr(method="spearman").round(2)
corr.to_csv(TAB / "02_predictor_spearman_corr.csv")
hi = (corr.abs() > 0.6) & (corr.abs() < 1)
pairs = [(corr.index[i], corr.columns[j], corr.iloc[i, j])
         for i in range(len(corr)) for j in range(i + 1, len(corr)) if hi.iloc[i, j]]
print("\nHighly correlated predictor pairs (|rho|>0.6):",
      pairs if pairs else "none")
print("\nDescriptives complete — tables in", TAB)
