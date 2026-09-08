"""Shared machinery for the two classification studies (prognostic & treatment).

Implements the CPV paper's 3-stage workflow:
  Stage A  all baseline predictors
  Stage B  logistic-regression univariate screen  (keep p < screen_p)
  Stage C  RFECV-selected subset
For each stage: run the model zoo (class-weight + SMOTE), metric table, OOF
ROC/PR/calibration for the top models, permutation importance, and penalised
logistic-regression odds ratios.
"""
from __future__ import annotations
import warnings
import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.base import clone
from sklearn.feature_selection import RFECV
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from scipy import stats

from .config import SEED, CV_FOLDS, FIGDIR, TABDIR
from .pipelines import build_classifier_zoo, make_preprocessor
from .evaluate import (
    cv_classification, oof_proba, plot_roc_pr, plot_calibration,
    permutation_importance_df, save_table,
)


# --------------------------------------------------------------------------- #
def univariate_screen(df, predictors, target, screen_p=0.20):
    """Per-predictor logistic regression; return those with LR p < screen_p."""
    rows = []
    y = df[target].astype(int).values
    for v in predictors:
        x = df[[v]].astype(float).values
        x = (x - np.nanmean(x)) / np.nanstd(x)
        x = sm.add_constant(x, has_constant="add")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = sm.Logit(y, x).fit(disp=0)
            p = res.pvalues[1]
            or_ = np.exp(res.params[1])
        except Exception:
            p, or_ = np.nan, np.nan
        rows.append({"predictor": v, "OR_per_SD": or_, "p_value": p})
    scr = pd.DataFrame(rows).sort_values("p_value")
    keep = scr.loc[scr["p_value"] < screen_p, "predictor"].tolist()
    return scr, keep


def rfecv_select(df, numeric, categorical, target, min_features=3):
    """RFECV with a logistic-regression estimator inside a CV-safe pipeline-free
    setting (preprocess once on full data for selection only, as in the paper)."""
    pre = make_preprocessor(numeric, categorical, scale=True)
    X = pre.fit_transform(df[numeric + (categorical or [])])
    names = pre.get_feature_names_out()
    y = df[target].astype(int).values
    est = LogisticRegression(penalty="l2", class_weight="balanced", max_iter=5000)
    cv = StratifiedKFold(CV_FOLDS, shuffle=True, random_state=SEED)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        sel = RFECV(est, step=1, cv=cv, scoring="roc_auc",
                    min_features_to_select=min_features).fit(X, y)
    chosen = [n for n, keep in zip(names, sel.support_) if keep]
    # map one-hot names back to original columns
    orig = []
    for c in numeric + (categorical or []):
        if c in numeric and f"{c}" in chosen:
            orig.append(c)
        elif categorical and c in categorical and any(n.startswith(c) for n in chosen):
            orig.append(c)
    return chosen, orig, int(sel.n_features_)


def penalised_odds_ratios(df, numeric, categorical, target, l2=1.0):
    """L2-penalised logistic regression OR table (handles quasi-separation)."""
    pre = make_preprocessor(numeric, categorical, scale=True)
    X = pre.fit_transform(df[numeric + (categorical or [])])
    names = list(pre.get_feature_names_out())
    y = df[target].astype(int).values
    Xc = sm.add_constant(X, has_constant="add")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        res = sm.Logit(y, Xc).fit_regularized(alpha=l2, L1_wt=0.0, disp=0)
    coef = res.params
    try:
        se = np.sqrt(np.diag(res.cov_params()))
    except Exception:
        se = np.full_like(coef, np.nan)
    out = []
    for i, nm in enumerate(["const"] + names):
        b, s = coef[i], se[i]
        out.append({"term": nm, "coef": b, "OR": np.exp(b),
                    "OR_lo95": np.exp(b - 1.96 * s), "OR_hi95": np.exp(b + 1.96 * s),
                    "z": b / s if s else np.nan,
                    "p": 2 * (1 - stats.norm.cdf(abs(b / s))) if s else np.nan})
    return pd.DataFrame(out)


# --------------------------------------------------------------------------- #
def run_stage(tag, df, numeric, categorical, target, *, positive_is_event=True):
    """Run one feature-set stage end to end. Returns dict of artefacts."""
    print(f"\n{'#'*80}\n# {tag}   predictors={len(numeric)}+{len(categorical or [])}cat"
          f"   target={target}\n{'#'*80}")
    X = df[numeric + (categorical or [])].copy()
    y = df[target].astype(int).values

    tables = {}
    for resamp in ("class_weight", "smote"):
        zoo = build_classifier_zoo(numeric, categorical, resampling=resamp, scale=True)
        res = cv_classification(zoo, X, y)
        res.insert(0, "resampling", resamp)
        tables[resamp] = res
        print(f"\n--- {resamp} ---")
        print(res.drop(columns=[c for c in res.columns if c.startswith("_")])
              .to_string(index=False))
    allres = pd.concat(tables.values(), ignore_index=True).sort_values(
        "_auc_mean", ascending=False)
    save_table(allres, f"{tag}_model_comparison.csv")

    # top-3 (by AUC) get OOF diagnostic curves
    top = allres.head(3)
    oof = {}
    zoo_cw = build_classifier_zoo(numeric, categorical, resampling="class_weight")
    zoo_sm = build_classifier_zoo(numeric, categorical, resampling="smote")
    for _, r in top.iterrows():
        est = (zoo_sm if r["resampling"] == "smote" else zoo_cw)[r["model"]]
        oof[f"{r['model']}·{r['resampling']}"] = oof_proba(est, X, y)
    plot_roc_pr(oof, y, f"{tag}_roc_pr.png", title=tag)
    plot_calibration(oof, y, f"{tag}_calibration.png", title=tag)

    # permutation importance on the best model
    best = top.iloc[0]
    best_est = (zoo_sm if best["resampling"] == "smote" else zoo_cw)[best["model"]]
    pimp = permutation_importance_df(best_est, X, y)
    pimp.to_csv(TABDIR / f"{tag}_perm_importance_{best['model']}.csv", index=False)
    print(f"\nPermutation importance — {best['model']} ({best['resampling']}):")
    print(pimp.to_string(index=False))

    # penalised logistic OR table
    orт = penalised_odds_ratios(df, numeric, categorical, target)
    orт.to_csv(TABDIR / f"{tag}_logit_odds_ratios.csv", index=False)
    print("\nPenalised logistic-regression odds ratios:")
    print(orт.round(3).to_string(index=False))

    return {"comparison": allres, "top": top, "perm_importance": pimp,
            "odds_ratios": orт, "best": best}
