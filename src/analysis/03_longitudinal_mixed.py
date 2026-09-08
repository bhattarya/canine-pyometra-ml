"""Roadmap step 3 — longitudinal analysis.

Linear mixed model per response:  y ~ C(Group) * Day  + (1 | Animal_ID)
on the D0/D3/D7/D14 repeated measures.  Reports the Group x Day interaction
(does response trajectory differ by protocol?) and plots mean trajectories.
"""
from __future__ import annotations
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import statsmodels.formula.api as smf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as CFG
from pyo import data as D

MEDICAL_GROUPS = CFG.MEDICAL_GROUPS

pd.set_option("display.width", 200)

long = D.longitudinal_frame().copy()
long["Group"] = pd.Categorical(long["Group"], categories=CFG.GROUPS)
RESPONSES = ["Clinical_VAS_0_10", "Vulvar_Discharge_VAS_0_3", "TLC_per_uL",
             "Neutrophils_per_uL", "BUN_mg_dL", "Creatinine_mg_dL",
             "Albumin_g_dL", "Uterine_Diameter_mm", "Temperature_C"]

rows = []
for y in RESPONSES:
    d = long[["Animal_ID", "Group", "Day", y]].dropna()
    # uterine diameter is structurally absent after OHE -> medical arms only
    if y == "Uterine_Diameter_mm":
        d = d[d["Group"].isin(CFG.MEDICAL_GROUPS)]
        d["Group"] = d["Group"].cat.remove_unused_categories()
    d = d.rename(columns={y: "resp"})
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            m = smf.mixedlm("resp ~ C(Group) * Day", d, groups=d["Animal_ID"]).fit()
            inter = [p for p in m.pvalues.index if ":" in p and "Day" in p]
            rows.append({
                "response": y,
                "Day_beta": round(m.params.get("Day", np.nan), 4),
                "Day_p": round(m.pvalues.get("Day", np.nan), 4),
                "min_GroupxDay_p": round(float(np.nanmin(m.pvalues[inter])), 4) if inter else np.nan,
                "any_GroupxDay_sig": bool((m.pvalues[inter] < 0.05).any()) if inter else False,
            })
        except Exception as e:
            print(f"  [{y}] mixedlm failed: {type(e).__name__}: {e}")
            rows.append({"response": y, "Day_beta": np.nan, "Day_p": np.nan,
                         "min_GroupxDay_p": np.nan, "any_GroupxDay_sig": None})

res = pd.DataFrame(rows)
res.to_csv(CFG.TABDIR / "03_mixedmodel_group_by_day.csv", index=False)
print(res.to_string(index=False))

# trajectory plots
fig, axes = plt.subplots(3, 3, figsize=(13, 10))
for ax, y in zip(axes.ravel(), RESPONSES):
    g = long.groupby(["Group", "Day"])[y].mean().reset_index()
    for grp in CFG.GROUPS:
        s = g[g.Group == grp]
        ax.plot(s["Day"], s[y], "o-", label=grp.split("_")[0])
    ax.set_title(y, fontsize=9)
    ax.set_xlabel("Day"); ax.grid(alpha=.3)
axes.ravel()[0].legend(fontsize=7)
fig.suptitle("Mean response trajectories by protocol (D0–D14)")
fig.tight_layout()
fig.savefig(CFG.FIGDIR / "03_trajectories.png", dpi=150)
print("saved", CFG.FIGDIR / "03_trajectories.png")
