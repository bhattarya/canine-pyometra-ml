"""Run the full analysis pipeline in order. Usage: python src/analysis/run_all.py"""
from __future__ import annotations
import runpy
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = [
    "01_data_audit.py",
    "02_descriptives.py",
    "03_longitudinal_mixed.py",
    "04_prognostic_ml.py",
    "05_treatment_prediction.py",
    "06_missing_data.py",
    "07_recovery_regression.py",
    "08_risk_score.py",
    "10_figures_for_talk.py",
    "11_finalize_model.py",           # prognostic (medical-failure) model — analysis artefact
    "13_finalize_treatment_model.py", # deployed model: treatment-success by chosen protocol
    "09_build_report.py",
]

if __name__ == "__main__":
    only = sys.argv[1:]
    for s in STEPS:
        if only and not any(o in s for o in only):
            continue
        print(f"\n{'='*100}\nRUNNING {s}\n{'='*100}", flush=True)
        t0 = time.time()
        runpy.run_path(str(HERE / s), run_name="__main__")
        print(f"[{s} done in {time.time()-t0:.1f}s]", flush=True)
