"""Predict medical-failure risk for a single new pyometra case.

Loads models/final_model.json (produced by src/analysis/11_finalize_model.py)
and applies the exact same maths as the web predictor, so the two always agree.

Usage:
  python src/predict_case.py --BUN 34 --Creatinine 1.5 --Albumin 2.1 \
                             --ALP 393 --Age 5.8 --Illness 11
  python src/predict_case.py --json '{"BUN_mg_dL":34,"Creatinine_mg_dL":1.5, ...}'
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "final_model.json"
ALIASES = {  # convenient CLI flags -> model feature names
    "BUN": "BUN_mg_dL", "Creatinine": "Creatinine_mg_dL", "Albumin": "Albumin_g_dL",
    "ALP": "ALP_U_L", "Age": "Age_years", "Illness": "Illness_Duration_days",
}


def load_model(path: Path = MODEL_PATH) -> dict:
    return json.loads(path.read_text())


def predict(values: dict, model: dict | None = None) -> dict:
    """values: {feature_name: number} for every model feature. Returns a card."""
    m = model or load_model()
    feats = m["features"]
    mu = m["standardisation"]["mean"]
    sd = m["standardisation"]["std"]
    coef = m["coef"]
    missing = [f for f in feats if f not in values or values[f] is None]
    if missing:
        raise ValueError(f"missing values for: {missing}")

    z = [(float(values[f]) - mu[i]) / sd[i] for i, f in enumerate(feats)]
    contribs = [coef[i] * z[i] for i in range(len(feats))]          # log-odds parts
    logit = m["intercept"] + sum(contribs)
    p = 1.0 / (1.0 + math.exp(-logit))

    lo, hi = m["risk_bands"]["cutpoints_prob"]
    band = "Low" if p < lo else ("Intermediate" if p < hi else "High")

    drivers = sorted(
        ({"feature": feats[i], "label": m["labels"][feats[i]],
          "value": float(values[feats[i]]),
          "direction": "raises" if contribs[i] > 0 else "lowers",
          "log_odds": round(contribs[i], 3)}
         for i in range(len(feats))),
        key=lambda d: abs(d["log_odds"]), reverse=True)

    hint = m["protocol_hint"].get(band, {})
    return {
        "probability_medical_failure": round(p, 3),
        "probability_success": round(1 - p, 3),
        "risk_band": band,
        "band_observed_failure_rate": m["risk_bands"]["table"].get(band, {}).get("observed_failure_rate"),
        "drivers": drivers,
        "protocol_context": hint,
        "model_auc_cv": m["performance"]["roc_auc_cv"],
        "disclaimer": m["disclaimer"],
    }


def _format_card(values: dict, card: dict) -> str:
    L = ["=" * 64, " CANINE PYOMETRA — MEDICAL-FAILURE RISK (day 14)", "=" * 64,
         " Entered values:"]
    for k, v in values.items():
        L.append(f"   {k:24s} {v}")
    p = card["probability_medical_failure"]
    L += ["", f"  Predicted risk of medical-treatment failure : {p:.0%}",
          f"  Predicted chance of success                 : {1 - p:.0%}",
          f"  Risk band                                   : {card['risk_band'].upper()}",
          "", "  What is driving this estimate:"]
    for d in card["drivers"]:
        bar = "#" * min(20, int(abs(d["log_odds"]) * 12))
        L.append(f"   {d['label']:34s} {d['value']:>7}  {d['direction']:<6} risk  {bar}")
    L += ["", "  Observed success by protocol in this risk band (training data, n small):"]
    for grp, s in card["protocol_context"].items():
        L.append(f"   {grp:24s} {s['success_rate']:.0%}  (n={s['n']})")
    L += ["", f"  Model discrimination (internal CV ROC-AUC): {card['model_auc_cv']}",
          "", "  " + card["disclaimer"], "=" * 64]
    return "\n".join(L)


def main() -> None:
    m = load_model()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", help="JSON object of feature: value")
    for short, full in ALIASES.items():
        ap.add_argument(f"--{short}", type=float, help=full)
    a = ap.parse_args()

    if a.json:
        values = json.loads(a.json)
    else:
        values = {full: getattr(a, short) for short, full in ALIASES.items()
                  if getattr(a, short) is not None}
    card = predict(values, m)
    print(_format_card(values, card))


if __name__ == "__main__":
    main()
