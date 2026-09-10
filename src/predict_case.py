"""Predict treatment-success probability for a single new pyometra case.

Loads models/final_model.json (produced by
src/analysis/13_finalize_treatment_model.py) and applies the same maths as the
web predictor, so the two always agree.

Usage:
  python src/predict_case.py --group G3_Aglepristone_PGF2a \
      --Age 6 --Illness 5 --HeartRate 120 --TLC 19 --Creatinine 1.0 \
      --Albumin 2.7 --ALP 310 --UterineDiameter 17 --VAS 5
  python src/predict_case.py --group G4_OHE --json '{"Age_years":6, ...}'
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "final_model.json"

ALIASES = {  # convenient CLI flags -> model feature names
    "Age": "Age_years",
    "Illness": "Illness_Duration_days",
    "HeartRate": "Heart_Rate_bpm",
    "TLC": "TLC_per_uL",
    "Creatinine": "Creatinine_mg_dL",
    "Albumin": "Albumin_g_dL",
    "ALP": "ALP_U_L",
    "UterineDiameter": "Uterine_Diameter_mm",
    "VAS": "Clinical_VAS_0_10",
}


def load_model(path: Path = MODEL_PATH) -> dict:
    return json.loads(path.read_text())


def predict(values: dict, group: str, model: dict | None = None) -> dict:
    m = model or load_model()
    feats = m["numeric_features"]
    mu = m["standardisation"]["mean"]
    sd = m["standardisation"]["std"]
    coef = m["numeric_coef"]
    if group not in m["groups"]:
        raise ValueError(f"group must be one of {m['groups']}")
    missing = [f for f in feats if f not in values or values[f] is None]
    if missing:
        raise ValueError(f"missing values for: {missing}")

    z = [(float(values[f]) - mu[i]) / sd[i] for i, f in enumerate(feats)]
    contribs = [coef[i] * z[i] for i in range(len(feats))]
    logit = m["intercept"] + sum(contribs) + m["group_coef"][group]
    p_model = 1.0 / (1.0 + math.exp(-logit))

    # G4/surgery: no outcome variance in the cohort -> report observed, not model
    g4_only = group == "G4_OHE"
    observed = m["protocol_observed"][group]["success_rate"]
    p = observed if g4_only else p_model

    lo, hi = m["success_bands"]["cutpoints_prob"]
    band = "Unlikely" if p < lo else ("Uncertain" if p < hi else "Likely")

    drivers = sorted(
        (
            {
                "feature": feats[i],
                "label": m["labels"][feats[i]],
                "value": float(values[feats[i]]),
                "direction": "supports success" if contribs[i] > 0 else "works against success",
                "log_odds": round(contribs[i], 3),
            }
            for i in range(len(feats))
        ),
        key=lambda d: abs(d["log_odds"]),
        reverse=True,
    )

    return {
        "group": group,
        "probability_success": round(p, 3),
        "probability_success_model": round(p_model, 3),
        "band": band,
        "g4_observed_only": g4_only,
        "observed_success_rate_for_group": observed,
        "drivers": drivers,
        "model_auc_cv": m["performance"]["roc_auc_cv"],
        "disclaimer": m["disclaimer"],
    }


def _card(values: dict, group: str, card: dict, m: dict) -> str:
    L = ["=" * 66, " CANINE PYOMETRA - TREATMENT-SUCCESS PREDICTION (day 14)", "=" * 66,
         f" Protocol : {m['group_labels'][group]}", " Admission values:"]
    for k, v in values.items():
        L.append(f"   {k:26s} {v}")
    p = card["probability_success"]
    L += ["",
          f"  Predicted chance of treatment success : {p:.0%}   ({card['band']})",
          f"  (chance of failure                    : {1 - p:.0%})"]
    if card["g4_observed_only"]:
        L.append("  NOTE: surgical arm - observed cohort rate shown; " + m["g4_caveat"])
    L += ["", "  What moves this estimate:"]
    for d in card["drivers"]:
        bar = "#" * min(20, int(abs(d["log_odds"]) * 12))
        L.append(f"   {d['label']:30s} {d['value']:>7}  {d['direction']:<22} {bar}")
    L += ["",
          f"  Observed success for this protocol in the cohort: "
          f"{card['observed_success_rate_for_group']:.0%}",
          f"  Model discrimination (internal CV ROC-AUC): {card['model_auc_cv']}",
          "", "  " + card["disclaimer"], "=" * 66]
    return "\n".join(L)


def main() -> None:
    m = load_model()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--group", required=True, choices=m["groups"])
    ap.add_argument("--json", help="JSON object of feature: value")
    for short, full in ALIASES.items():
        ap.add_argument(f"--{short}", type=float, help=full)
    a = ap.parse_args()

    if a.json:
        values = json.loads(a.json)
    else:
        values = {full: getattr(a, short) for short, full in ALIASES.items()
                  if getattr(a, short) is not None}
    card = predict(values, a.group, m)
    print(_card(values, a.group, card, m))


if __name__ == "__main__":
    main()
