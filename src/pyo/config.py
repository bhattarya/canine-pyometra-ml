"""Central configuration: paths, seeds, feature sets, outcome definitions."""
from __future__ import annotations
from pathlib import Path

# ----------------------------------------------------------------------------- #
# Paths
# ----------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = ROOT / "data" / "raw" / "canine_pyometra_80.xlsx"
DATA_PROC = ROOT / "data" / "processed"
RESULTS = ROOT / "results"
FIGDIR = RESULTS / "figures"
TABDIR = RESULTS / "tables"
REPORTS = ROOT / "reports"
for _d in (DATA_PROC, FIGDIR, TABDIR, REPORTS):
    _d.mkdir(parents=True, exist_ok=True)

# ----------------------------------------------------------------------------- #
# Reproducibility
# ----------------------------------------------------------------------------- #
SEED = 42
CV_FOLDS = 5          # stratified k-fold (roadmap step 6)
CV_REPEATS = 10       # repeated CV to stabilise estimates on n=80

# ----------------------------------------------------------------------------- #
# Treatment protocols
# ----------------------------------------------------------------------------- #
GROUPS = ["G1_Supportive", "G2_PGF2a", "G3_Aglepristone_PGF2a", "G4_OHE"]
MEDICAL_GROUPS = ["G1_Supportive", "G2_PGF2a", "G3_Aglepristone_PGF2a"]

# ----------------------------------------------------------------------------- #
# Variable groups (baseline / admission-day only — no D3/D7/D14 predictors)
# ----------------------------------------------------------------------------- #
DEMOGRAPHIC = ["Age_years", "Illness_Duration_days", "Weight_kg"]

CLINICAL = [
    "Temperature_C", "Heart_Rate_bpm", "Resp_Rate_bpm",
    "Clinical_VAS_0_10", "Vulvar_Discharge_VAS_0_3",
]

HAEMATOLOGY = ["TLC_per_uL", "Neutrophils_per_uL"]

BIOCHEMISTRY = [
    "BUN_mg_dL", "Creatinine_mg_dL", "ALP_U_L", "ALT_U_L",
    "Total_Protein_g_dL", "Albumin_g_dL", "Globulin_g_dL",
]

IMAGING_ENDOCRINE = ["Uterine_Diameter_mm", "Progesterone_ng_mL"]

# Pre-computed binary risk flags supplied in the workbook
RISK_FLAGS = [
    "Hypoalbuminemia_flag", "Leukocytosis_flag", "Azotemia_flag",
    "Severe_Inflammation_flag", "High_Clinical_Severity_flag",
]

# Full baseline predictor pool (continuous + Group), used for the prognostic model
BASELINE_ALL = DEMOGRAPHIC + CLINICAL + HAEMATOLOGY + BIOCHEMISTRY + IMAGING_ENDOCRINE

# Curated pool used in the workbook's ML_Treatment_Prediction sheet
TREATMENT_PREDICTORS = [
    "Age_years", "Illness_Duration_days", "Weight_kg", "Temperature_C",
    "Heart_Rate_bpm", "Clinical_VAS_0_10", "TLC_per_uL", "BUN_mg_dL",
    "Creatinine_mg_dL", "Albumin_g_dL", "Uterine_Diameter_mm",
]

CATEGORICAL = ["Group"]

# ----------------------------------------------------------------------------- #
# Outcomes
# ----------------------------------------------------------------------------- #
# Primary  : Treatment_Success_D14 (1 = success) on all 80 dogs, Group retained
# Prognostic: Medical_Failure_D14 (1 = failure) on G1-G3 (n=60), no Group
# Regression: Days_to_Resolution (continuous, resolvers only)
TARGET_PRIMARY = "Treatment_Success_D14"
TARGET_PROGNOSTIC = "Medical_Failure_D14"
TARGET_REGRESSION = "Days_to_Resolution"

# Outcomes present but NOT modellable (documented, not modelled):
#   Death           -> 1/80 event   (no variance)
#   Recurrence_6mo  -> 4/80 events  (too few)
UNMODELLABLE = {"Death": "1/80 event", "Recurrence_6mo": "4/80 events"}
