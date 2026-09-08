"""Load and assemble analysis-ready tables from the raw workbook.

Workbook quirks handled here:
  * every sheet has a title row + a blank row above the real header
  * column names carry mojibake ('TLCუuL' -> 'TLC_per_uL', 'µ'/'μ' -> 'u')
  * the 4 summary sheets are metadata, not data
"""
from __future__ import annotations
import re
import pandas as pd

from .config import (
    DATA_RAW, DATA_PROC, MEDICAL_GROUPS,
    BASELINE_ALL, TREATMENT_PREDICTORS, RISK_FLAGS,
    TARGET_PRIMARY, TARGET_PROGNOSTIC, TARGET_REGRESSION,
)

_MOJIBAKE = {"უ": "_per_", "µ": "u", "μ": "u"}


def _clean(name: str) -> str:
    for bad, good in _MOJIBAKE.items():
        name = name.replace(bad, good)
    name = re.sub(r"[^0-9A-Za-z]+", "_", str(name)).strip("_")
    return name


def load_sheet(sheet: str) -> pd.DataFrame:
    """Return a sheet with the real header, blank/title rows stripped,
    clean column names and numeric coercion where lossless."""
    raw = pd.read_excel(DATA_RAW, sheet_name=sheet, header=None)
    raw = raw.dropna(how="all").reset_index(drop=True)
    hdr = next(
        (i for i in range(min(6, len(raw))) if raw.iloc[i].notna().sum() > 1), 0
    )
    df = raw.iloc[hdr + 1:].copy()
    df.columns = [_clean(c) for c in raw.iloc[hdr].tolist()]
    df = df.dropna(how="all").reset_index(drop=True)
    for c in df.columns:
        conv = pd.to_numeric(df[c], errors="coerce")
        if conv.notna().sum() == df[c].notna().sum():
            df[c] = conv
    return df


# --------------------------------------------------------------------------- #
# Assembled analysis frames
# --------------------------------------------------------------------------- #
def baseline_with_outcomes() -> pd.DataFrame:
    """80 dogs: Day-0 baseline + all outcome columns, merged on Animal_ID."""
    base = load_sheet("80_Animal_Baseline").drop(columns=["Day"], errors="ignore")
    out = load_sheet("Treatment_Outcomes").drop(columns=["Group"], errors="ignore")
    df = base.merge(out, on="Animal_ID", how="left", validate="one_to_one")
    return df


def primary_frame() -> pd.DataFrame:
    """All 80 dogs, Group + curated admission predictors, Treatment_Success_D14.
    Mirrors the workbook's ML_Treatment_Prediction sheet but rebuilt from source
    so the full baseline pool is also available."""
    df = baseline_with_outcomes()
    keep = ["Animal_ID", "Group"] + BASELINE_ALL + RISK_FLAGS + [
        TARGET_PRIMARY, "Medical_Failure_D14", "Rescue_OHE", "Death",
    ]
    return df[keep].copy()


def prognostic_frame() -> pd.DataFrame:
    """G1-G3 only (n=60), full baseline pool, Medical_Failure_D14 target,
    Group dropped (roadmap step 5)."""
    df = baseline_with_outcomes()
    df = df[df["Group"].isin(MEDICAL_GROUPS)].reset_index(drop=True)
    keep = ["Animal_ID"] + BASELINE_ALL + RISK_FLAGS + [TARGET_PROGNOSTIC]
    return df[keep].copy()


def missing_practice_frame() -> pd.DataFrame:
    """G1-G3 with ~5% MCAR cells blanked (roadmap step 10)."""
    return load_sheet("ML_missing_5pct")


def longitudinal_frame() -> pd.DataFrame:
    """320 rows = 80 dogs x {D0,D3,D7,D14} for mixed-model analysis (step 3)."""
    return load_sheet("Repeated_D0_D3_D7_D14")


def recovery_frame() -> pd.DataFrame:
    """Dogs with a recorded Days_to_Resolution + baseline predictors."""
    df = baseline_with_outcomes()
    df = df[df[TARGET_REGRESSION].notna()].reset_index(drop=True)
    keep = ["Animal_ID", "Group"] + BASELINE_ALL + RISK_FLAGS + [TARGET_REGRESSION]
    return df[keep].copy()


def retro_frame() -> pd.DataFrame:
    """240 retrospective cases — case-mix only (Breed, Age, Type, Management).
    NOTE: this sheet has NO outcome column, so it supports descriptive /
    case-mix comparison only, not a prognostic model."""
    return load_sheet("Retro_6mo_240cases")


def dump_processed() -> dict[str, tuple[int, int]]:
    """Write every assembled frame to data/processed/ as CSV. Returns shapes."""
    frames = {
        "baseline_with_outcomes": baseline_with_outcomes(),
        "primary_treatment_prediction": primary_frame(),
        "prognostic_G1G3": prognostic_frame(),
        "missing_practice_G1G3": missing_practice_frame(),
        "longitudinal_D0_D3_D7_D14": longitudinal_frame(),
        "recovery_time": recovery_frame(),
        "retro_240_casemix": retro_frame(),
    }
    shapes = {}
    for name, fr in frames.items():
        fr.to_csv(DATA_PROC / f"{name}.csv", index=False)
        shapes[name] = fr.shape
    return shapes


if __name__ == "__main__":
    for k, v in dump_processed().items():
        print(f"{k:32s} {v}")
