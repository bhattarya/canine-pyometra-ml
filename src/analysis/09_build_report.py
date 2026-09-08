"""Assemble reports/findings.md from the generated tables & figures.
Run after 01-08.  Pure formatting — no modelling here.
"""
from __future__ import annotations
import sys
from pathlib import Path
from datetime import date

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pyo import config as C

TAB, FIG = C.TABDIR, C.FIGDIR
OUT = C.REPORTS / "findings.md"


def md_table(path: Path, floatfmt=3, max_rows=None):
    if not path.exists():
        return f"_(missing: {path.name})_\n"
    df = pd.read_csv(path)
    if max_rows:
        df = df.head(max_rows)
    for c in df.select_dtypes("float"):
        df[c] = df[c].round(floatfmt)
    return df.to_markdown(index=False) + "\n"


def fig_link(name: str, caption: str):
    # findings.md lives in reports/ , figures in results/figures/
    return f"![{caption}](../results/figures/{name})\n\n*{caption}*\n"


parts = [f"""# Canine Pyometra — Machine-Learning Findings

_Generated {date.today().isoformat()} from `results/` by `src/analysis/09_build_report.py`._

> Methodology-demonstration analysis on a clean, randomised, balanced 80-animal
> teaching dataset (no missing baseline data). Hypothesis-generating, not a
> validated clinical tool. Workflow mirrors Nafe Monfared et al. (Front. Vet.
> Sci. 2025) canine-parvovirus prognosis pipeline and the workbook's ML_Roadmap.

---

## 1. Data audit

Sheet inventory:

{md_table(TAB / "01_sheet_inventory.csv")}

Outcome rates by treatment arm:

{md_table(TAB / "01_outcome_rates_by_arm.csv")}

Randomisation balance across G1-G4 (baseline predictors) — ANOVA / Kruskal-Wallis:

{md_table(TAB / "01_randomisation_balance.csv")}

**Read:** 80 unique dogs, no duplicates, no implausible values. Baseline
variables are balanced across arms (no ANOVA p < 0.05). Observed success
gradient G1 65 % -> G2 75 % -> G3 90 % -> G4 100 %. Death (1/80) and
6-month recurrence (4/80) are too rare to model.

---

## 2. Descriptives & univariate screening

Baseline by D14 outcome, ranked by univariate AUC for *failure*:

{md_table(TAB / "02_table2_baseline_by_outcome.csv")}

Derived risk flags vs failure:

{md_table(TAB / "02_risk_flags_vs_outcome.csv")}

**Read:** renal markers (BUN, creatinine), hepatic markers (ALT, ALP) and
hypoalbuminaemia separate failures from successes most strongly; illness
duration and age are weaker secondary signals.

---

## 3. Longitudinal analysis (mixed model: Group * Day + 1|ID)

{md_table(TAB / "03_mixedmodel_group_by_day.csv")}

{fig_link("03_trajectories.png", "Mean response trajectories by protocol, D0-D14")}

---

## 4. Prognostic model (G1-G3, admission variables only -> Medical_Failure_D14)

Stage progression (all predictors -> univariate screen -> RFECV):

{md_table(TAB / "04_stage_progression.csv")}

Univariate logistic screen:

{md_table(TAB / "04_univariate_screen.csv")}

Best-stage model comparison (RFECV feature set):

{md_table(TAB / "04C_prognostic_rfecv_model_comparison.csv", max_rows=8)}

{fig_link("04C_prognostic_rfecv_roc_pr.png", "Prognostic model — out-of-fold ROC & PR (RFECV features)")}
{fig_link("04C_prognostic_rfecv_calibration.png", "Prognostic model — calibration")}

Penalised logistic-regression odds ratios (RFECV features):

{md_table(TAB / "04C_prognostic_rfecv_logit_odds_ratios.csv")}

**Read:** discrimination is high and stable across all three feature-set stages
(ROC-AUC ≈ 0.95). The top ~6 algorithms differ by less than the CV standard
deviation, so model choice is not critical — L2 logistic regression and random
forest give essentially the same performance as the nominal best (QDA on the
3-feature RFECV set) while being easier to explain. All final models point to
the same drivers: **higher BUN / creatinine / ALP and lower albumin** raise the
probability of medical failure.

---

## 5. Treatment-outcome model (all G1-G4, Group retained -> Treatment_Success_D14)

Stage progression + G1-G3 sensitivity analysis:

{md_table(TAB / "05_stage_progression.csv")}

Model comparison (screened feature set + Group):

{md_table(TAB / "05B_treat_screened_model_comparison.csv", max_rows=8)}

{fig_link("05B_treat_screened_roc_pr.png", "Treatment-outcome model — out-of-fold ROC & PR")}

Full-cohort odds ratios (screened + Group) — **unstable, see caveat**:

{md_table(TAB / "05B_treat_screened_logit_odds_ratios.csv")}

**Caveat:** G4 (OHE) is perfectly separated (20/20 success), so the full-cohort
`Group` odds ratios and the near-zero ridge-shrunk coefficients above are
artefacts and shown for completeness only.

### G1–G3 sensitivity model (Group dropped — the interpretable one)

{md_table(TAB / "05S_treat_G1G3_noGroup_model_comparison.csv", max_rows=6)}

Odds ratios (G1–G3, admission variables only, outcome = *success*):

{md_table(TAB / "05S_treat_G1G3_noGroup_logit_odds_ratios.csv")}

**Read:** on the medical cohort the treatment-success model reproduces the
prognostic model mirror-image — higher BUN / ALP push toward failure, higher
albumin toward success — and still discriminates well (ROC-AUC ≈ 0.95).

---

## 6. Missing-data strategy (ML_missing_5pct, ~5 % MCAR)

Imputation accuracy (standardised RMSE vs the true values):

{md_table(TAB / "06_imputation_accuracy.csv")}

Downstream prognostic-model AUC by imputer:

{md_table(TAB / "06_imputation_downstream_auc.csv")}

---

## 7. Recovery-time regression (Days_to_Resolution, n = 74)

{md_table(TAB / "07_recovery_model_comparison.csv")}

Univariate association with recovery time:

{md_table(TAB / "07_recovery_univariate_screen.csv")}

Recovery time by protocol:

{md_table(TAB / "07_recovery_by_group.csv")}

---

## 8. Admission risk score -> protocol recommendation

Score weights (per 1 SD of admission value):

{md_table(TAB / "08_risk_score_coefficients.csv")}

Success rate by risk class:

{md_table(TAB / "08_success_by_riskclass.csv")}

Risk class x protocol x outcome:

{md_table(TAB / "08_riskclass_by_protocol.csv")}

**Practical reading (hypothesis-generating, n = 80):**
- **Low risk** — every protocol reached 100 % success; medical management,
  including supportive-only (G1), is adequate.
- **Medium risk** — supportive-only (G1) slips (~0.80); G2 / G3 and OHE ~1.00,
  so an active medical protocol is preferred over G1 alone.
- **High risk** — medical success collapses (G1 ~0.25, G2 ~0.17); aglepristone +
  PGF2alpha (G3) is the best medical option (~0.67); OHE (G4) remains ~1.00 and
  is the safe definitive choice.

---

## Limitations

1. Single synthetic/simulated-looking cohort, n = 80, 14 failure events — wide
   confidence intervals; external validity unknown.
2. G4 non-randomised w.r.t. severity and perfectly separated on outcome.
3. The 240-case retrospective sheet has no outcome column — usable only for
   case-mix description, not prognostic validation.
4. Repeated cross-validation gives an optimism-reduced *internal* estimate only.
"""]

OUT.write_text("\n".join(parts))
print("wrote", OUT)
