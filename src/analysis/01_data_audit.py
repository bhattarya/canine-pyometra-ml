"""Roadmap step 1 — data audit.

N, duplicates, value ranges / implausible values, missingness, and
randomisation balance across the four treatment arms.
Outputs: results/tables/01_*.csv  and prints a summary.
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

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 60)

TAB = C.TABDIR


def section(t): print("\n" + "=" * 90 + f"\n{t}\n" + "=" * 90)


# --------------------------------------------------------------------------- #
section("1. Sheet inventory & shapes")
shapes = D.dump_processed()
inv = pd.DataFrame([(k, *v) for k, v in shapes.items()],
                   columns=["frame", "rows", "cols"])
print(inv.to_string(index=False))
inv.to_csv(TAB / "01_sheet_inventory.csv", index=False)

base = D.baseline_with_outcomes()
primary = D.primary_frame()
prog = D.prognostic_frame()

# --------------------------------------------------------------------------- #
section("2. Duplicates & IDs")
print(f"Animal_ID unique: {base['Animal_ID'].is_unique}  (n={len(base)})")
print(f"Fully duplicated rows: {base.duplicated().sum()}")
dup_feats = base.drop(columns=['Animal_ID']).duplicated().sum()
print(f"Duplicated feature rows (ignoring ID): {dup_feats}")

# --------------------------------------------------------------------------- #
section("3. Ranges & implausible values (baseline predictors)")
num = C.BASELINE_ALL
desc = base[num].describe().T
# simple physiologic sanity bounds for dogs
BOUNDS = {
    "Temperature_C": (35, 43), "Heart_Rate_bpm": (40, 260),
    "Resp_Rate_bpm": (5, 120), "Age_years": (0, 20), "Weight_kg": (1, 90),
    "Creatinine_mg_dL": (0.1, 15), "BUN_mg_dL": (2, 200),
    "Albumin_g_dL": (0.5, 6), "Total_Protein_g_dL": (2, 12),
    "TLC_per_uL": (0.5, 150), "Neutrophils_per_uL": (0.1, 120),
    "Illness_Duration_days": (0, 60), "Progesterone_ng_mL": (0, 100),
    "Uterine_Diameter_mm": (2, 100), "Clinical_VAS_0_10": (0, 10),
    "Vulvar_Discharge_VAS_0_3": (0, 3), "ALP_U_L": (5, 3000), "ALT_U_L": (5, 3000),
    "Globulin_g_dL": (0.5, 9),
}
flags = []
for v, (lo, hi) in BOUNDS.items():
    bad = base[(base[v] < lo) | (base[v] > hi)]
    if len(bad):
        flags.append((v, lo, hi, len(bad), bad[v].min(), bad[v].max()))
desc.to_csv(TAB / "01_baseline_describe.csv")
if flags:
    fdf = pd.DataFrame(flags, columns=["var", "lo", "hi", "n_out", "min_out", "max_out"])
    print(fdf.to_string(index=False))
    fdf.to_csv(TAB / "01_implausible_values.csv", index=False)
else:
    print("No values outside physiologic sanity bounds.")
print("\n", desc[["min", "25%", "50%", "75%", "max"]].round(2).to_string())

# --------------------------------------------------------------------------- #
section("4. Missingness")
miss = (base.isna().mean() * 100).round(1)
miss = miss[miss > 0].sort_values(ascending=False)
print("baseline_with_outcomes — % missing (non-zero only):")
print(miss.to_string() if len(miss) else "  none")
miss.to_frame("pct_missing").to_csv(TAB / "01_missingness.csv")

# --------------------------------------------------------------------------- #
section("5. Randomisation balance across G1–G4 (baseline predictors)")
rows = []
for v in C.BASELINE_ALL:
    groups = [g[v].dropna().values for _, g in base.groupby("Group")]
    f, p_anova = stats.f_oneway(*groups)
    h, p_kw = stats.kruskal(*groups)
    rows.append({"variable": v,
                 "G1_mean": base.loc[base.Group == "G1_Supportive", v].mean(),
                 "G2_mean": base.loc[base.Group == "G2_PGF2a", v].mean(),
                 "G3_mean": base.loc[base.Group == "G3_Aglepristone_PGF2a", v].mean(),
                 "G4_mean": base.loc[base.Group == "G4_OHE", v].mean(),
                 "ANOVA_p": p_anova, "KruskalWallis_p": p_kw})
bal = pd.DataFrame(rows).round(3)
print(bal.to_string(index=False))
bal.to_csv(TAB / "01_randomisation_balance.csv", index=False)
n_imbal = int((bal["ANOVA_p"] < 0.05).sum())
print(f"\nVariables with ANOVA p<0.05 across arms: {n_imbal} / {len(bal)}")

# --------------------------------------------------------------------------- #
section("6. Outcome rates by arm")
tab = (base.assign(fail=1 - base["Treatment_Success_D14"])
       .groupby("Group")
       .agg(n=("Animal_ID", "size"),
            success=("Treatment_Success_D14", "sum"),
            medical_failure=("Medical_Failure_D14", "sum"),
            rescue_OHE=("Rescue_OHE", "sum"),
            death=("Death", "sum"),
            recurrence_6mo=("Recurrence_6mo", "sum"),
            mean_days_to_resolution=("Days_to_Resolution", "mean")))
tab["success_rate"] = (tab["success"] / tab["n"]).round(3)
print(tab.to_string())
tab.to_csv(TAB / "01_outcome_rates_by_arm.csv")

section("7. Class balance for modelling targets")
print(f"Treatment_Success_D14 (n=80):  {dict(base['Treatment_Success_D14'].value_counts())}"
      f"  -> failure rate {1 - base['Treatment_Success_D14'].mean():.1%}")
print(f"Medical_Failure_D14  (G1-G3, n={len(prog)}): "
      f"{dict(prog['Medical_Failure_D14'].value_counts())}")
print(f"Days_to_Resolution non-missing: {base['Days_to_Resolution'].notna().sum()} / 80")
print(f"Death events: {int(base['Death'].sum())}  |  Recurrence_6mo events: "
      f"{int(base['Recurrence_6mo'].sum())}   (both left unmodelled)")

print("\nAudit complete — tables in", TAB)
