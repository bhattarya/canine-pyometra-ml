"""Presentation-ready summary figures (results/figures/talk_*.png)."""
from __future__ import annotations
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C
from pyo import data as D

FIG = C.FIGDIR
plt.rcParams.update({"figure.dpi": 150, "font.size": 11})

base = D.baseline_with_outcomes()

# ---- 1. success rate by protocol -------------------------------------------- #
g = (base.groupby("Group")["Treatment_Success_D14"]
     .agg(["mean", "count", "sum"]).reindex(C.GROUPS))
fig, ax = plt.subplots(figsize=(6.4, 4))
bars = ax.bar([x.split("_")[0] for x in g.index], g["mean"], color="#4C72B0")
for b, (_, r) in zip(bars, g.iterrows()):
    ax.text(b.get_x() + b.get_width() / 2, r["mean"] + 0.02,
            f"{int(r['sum'])}/{int(r['count'])}", ha="center", fontsize=10)
ax.set(ylim=(0, 1.12), ylabel="Treatment success by D14", title="Success rate by protocol")
ax.grid(axis="y", alpha=.3)
fig.tight_layout(); fig.savefig(FIG / "talk_success_by_protocol.png"); plt.close(fig)

# ---- 2. univariate AUC for failure ---------------------------------------- #
t2 = pd.read_csv(C.TABDIR / "02_table2_baseline_by_outcome.csv").head(10)[::-1]
fig, ax = plt.subplots(figsize=(6.8, 4.4))
ax.barh(t2["variable"], t2["univ_AUC_fail"], color="#C44E52")
ax.axvline(0.5, ls="--", c="k", lw=1)
ax.set(xlim=(0.4, 1.0), xlabel="Univariate AUC for medical failure",
       title="Strongest admission predictors of failure")
ax.grid(axis="x", alpha=.3)
fig.tight_layout(); fig.savefig(FIG / "talk_univariate_auc.png"); plt.close(fig)

# ---- 3. risk class x protocol heatmap ------------------------------------ #
tab = pd.read_csv(C.TABDIR / "08_riskclass_by_protocol.csv")
piv = tab.pivot(index="risk_class", columns="Group", values="success_rate") \
         .reindex(["Low", "Medium", "High"])[C.GROUPS]
fig, ax = plt.subplots(figsize=(7, 3.6))
im = ax.imshow(piv.values, cmap="RdYlGn", vmin=0, vmax=1, aspect="auto")
ax.set_xticks(range(4), [x.split("_")[0] for x in piv.columns])
ax.set_yticks(range(3), piv.index)
for i in range(3):
    for j in range(4):
        n = tab[(tab.risk_class == piv.index[i]) & (tab.Group == piv.columns[j])]["n"].iloc[0]
        ax.text(j, i, f"{piv.values[i, j]:.0%}\n(n={n})", ha="center", va="center", fontsize=10)
ax.set_title("Observed success rate — risk class × protocol")
fig.colorbar(im, ax=ax, label="success rate")
fig.tight_layout(); fig.savefig(FIG / "talk_riskclass_protocol.png"); plt.close(fig)

# ---- 4. prognostic model comparison (AUC) ------------------------------- #
_mc_path = C.TABDIR / "04C_prognostic_rfecv_model_comparison.csv"
if not _mc_path.exists():
    print(f"skip talk_prognostic_model_comparison — run 04_prognostic_ml.py first "
          f"({_mc_path.name} missing)")
    sys.exit(0)
mc = pd.read_csv(_mc_path)
mc = mc[mc["resampling"] == "class_weight"].copy()
mc["auc"] = mc["ROC_AUC"].str.split(" ± ").str[0].astype(float)
mc["sd"] = mc["ROC_AUC"].str.split(" ± ").str[1].astype(float)
mc = mc.sort_values("auc").tail(10)
fig, ax = plt.subplots(figsize=(6.8, 4.4))
ax.barh(mc["model"], mc["auc"], xerr=mc["sd"], color="#55A868", capsize=3)
ax.set(xlim=(0.6, 1.0), xlabel="Cross-validated ROC-AUC",
       title="Prognostic model — algorithm comparison (RFECV features)")
ax.grid(axis="x", alpha=.3)
fig.tight_layout(); fig.savefig(FIG / "talk_prognostic_model_comparison.png"); plt.close(fig)

print("wrote talk_*.png to", FIG)
