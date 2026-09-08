"""Cross-validated evaluation, metric tables and diagnostic plots."""
from __future__ import annotations

import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.base import clone
from sklearn.calibration import calibration_curve
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    average_precision_score, balanced_accuracy_score, brier_score_loss,
    f1_score, precision_score, recall_score, roc_auc_score, roc_curve,
    precision_recall_curve, mean_absolute_error, mean_squared_error, r2_score,
)
from sklearn.model_selection import (
    RepeatedStratifiedKFold, StratifiedKFold, cross_val_predict, KFold,
)

from .config import SEED, CV_FOLDS, CV_REPEATS, FIGDIR, TABDIR


# --------------------------------------------------------------------------- #
# Classification
# --------------------------------------------------------------------------- #
def _spec(y_true, y_pred):
    tn = np.sum((y_true == 0) & (y_pred == 0))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    return tn / (tn + fp) if (tn + fp) else np.nan


def cv_classification(models: dict, X, y, *, positive_label=1,
                      folds=CV_FOLDS, repeats=CV_REPEATS, threshold=0.5):
    """Repeated stratified CV. Returns a tidy DataFrame of per-model
    mean +/- sd for the roadmap metric set (out-of-fold pooled)."""
    y = np.asarray(y)
    rows = []
    for name, est in models.items():
        cv = RepeatedStratifiedKFold(n_splits=folds, n_repeats=repeats,
                                     random_state=SEED)
        aucs, aps, bal, f1s, sens, spec, brier = ([] for _ in range(7))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for tr, te in cv.split(X, y):
                Xtr = X.iloc[tr] if hasattr(X, "iloc") else X[tr]
                Xte = X.iloc[te] if hasattr(X, "iloc") else X[te]
                try:
                    m = clone(est).fit(Xtr, y[tr])
                    p = m.predict_proba(Xte)[:, 1]
                except Exception:
                    continue
                yhat = (p >= threshold).astype(int)
                aucs.append(roc_auc_score(y[te], p))
                aps.append(average_precision_score(y[te], p))
                bal.append(balanced_accuracy_score(y[te], yhat))
                f1s.append(f1_score(y[te], yhat, zero_division=0))
                sens.append(recall_score(y[te], yhat, zero_division=0))
                spec.append(_spec(y[te], yhat))
                brier.append(brier_score_loss(y[te], p))
        if not aucs:
            rows.append({"model": name, "ROC_AUC": "FAILED", "PR_AUC": "",
                         "Balanced_Acc": "", "Sensitivity": "", "Specificity": "",
                         "F1": "", "Brier": "", "_auc_mean": np.nan, "_ap_mean": np.nan})
            continue
        def ms(a):
            a = np.asarray(a, float)
            return f"{np.nanmean(a):.3f} ± {np.nanstd(a):.3f}"
        rows.append({
            "model": name, "ROC_AUC": ms(aucs), "PR_AUC": ms(aps),
            "Balanced_Acc": ms(bal), "Sensitivity": ms(sens),
            "Specificity": ms(spec), "F1": ms(f1s), "Brier": ms(brier),
            "_auc_mean": np.mean(aucs), "_ap_mean": np.mean(aps),
        })
    return (pd.DataFrame(rows).sort_values("_auc_mean", ascending=False)
            .reset_index(drop=True))


def oof_proba(est, X, y, folds=CV_FOLDS):
    """Single-pass stratified out-of-fold probabilities for plots."""
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=SEED)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return cross_val_predict(est, X, y, cv=cv, method="predict_proba")[:, 1]


def plot_roc_pr(oof: dict, y, fname, title=""):
    y = np.asarray(y)
    fig, ax = plt.subplots(1, 2, figsize=(11, 4.6))
    for name, p in oof.items():
        fpr, tpr, _ = roc_curve(y, p)
        ax[0].plot(fpr, tpr, lw=1.8, label=f"{name} (AUC={roc_auc_score(y,p):.3f})")
        pr, rc, _ = precision_recall_curve(y, p)
        ax[1].plot(rc, pr, lw=1.8,
                   label=f"{name} (AP={average_precision_score(y,p):.3f})")
    ax[0].plot([0, 1], [0, 1], "k--", lw=1)
    ax[0].set(xlabel="1 − specificity", ylabel="sensitivity", title="ROC (out-of-fold)")
    base = y.mean()
    ax[1].axhline(base, ls="--", c="k", lw=1)
    ax[1].set(xlabel="recall", ylabel="precision", title="Precision–Recall (out-of-fold)")
    for a in ax:
        a.legend(fontsize=7, loc="lower left" if a is ax[1] else "lower right")
        a.grid(alpha=.3)
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(FIGDIR / fname, dpi=150)
    plt.close(fig)
    return FIGDIR / fname


def plot_calibration(oof: dict, y, fname, title="", bins=6):
    y = np.asarray(y)
    fig, ax = plt.subplots(figsize=(5.4, 5))
    ax.plot([0, 1], [0, 1], "k--", lw=1, label="perfect")
    for name, p in oof.items():
        frac, mean_pred = calibration_curve(y, p, n_bins=bins, strategy="quantile")
        ax.plot(mean_pred, frac, "o-", lw=1.6, ms=5,
                label=f"{name} (Brier={brier_score_loss(y,p):.3f})")
    ax.set(xlabel="mean predicted probability", ylabel="observed frequency",
           title=title or "Calibration (out-of-fold)")
    ax.legend(fontsize=8)
    ax.grid(alpha=.3)
    fig.tight_layout()
    fig.savefig(FIGDIR / fname, dpi=150)
    plt.close(fig)
    return FIGDIR / fname


def permutation_importance_df(est, X, y, *, scoring="roc_auc",
                              n_repeats=20, folds=CV_FOLDS):
    """Mean permutation importance over held-out folds."""
    y = np.asarray(y)
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=SEED)
    acc = np.zeros((folds, X.shape[1]))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for i, (tr, te) in enumerate(cv.split(X, y)):
            m = clone(est).fit(X.iloc[tr], y[tr])
            r = permutation_importance(m, X.iloc[te], y[te], scoring=scoring,
                                       n_repeats=n_repeats, random_state=SEED)
            acc[i] = r.importances_mean
    return (pd.DataFrame({"feature": X.columns,
                          "importance_mean": acc.mean(0),
                          "importance_sd": acc.std(0)})
            .sort_values("importance_mean", ascending=False)
            .reset_index(drop=True))


# --------------------------------------------------------------------------- #
# Regression
# --------------------------------------------------------------------------- #
def cv_regression(models: dict, X, y, folds=CV_FOLDS, repeats=CV_REPEATS):
    y = np.asarray(y, float)
    rows = []
    for name, est in models.items():
        cv = KFold(n_splits=folds, shuffle=True, random_state=SEED)
        mae, rmse, r2 = [], [], []
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for _ in range(repeats):
                for tr, te in cv.split(X):
                    m = clone(est).fit(X.iloc[tr], y[tr])
                    pred = m.predict(X.iloc[te])
                    mae.append(mean_absolute_error(y[te], pred))
                    rmse.append(mean_squared_error(y[te], pred) ** 0.5)
                    r2.append(r2_score(y[te], pred))
                cv = KFold(n_splits=folds, shuffle=True,
                           random_state=SEED + len(rmse))
        def ms(a):
            a = np.asarray(a, float)
            return f"{a.mean():.3f} ± {a.std():.3f}"
        rows.append({"model": name, "MAE_days": ms(mae), "RMSE_days": ms(rmse),
                     "R2": ms(r2), "_rmse": np.mean(rmse)})
    return pd.DataFrame(rows).sort_values("_rmse").reset_index(drop=True)


def save_table(df: pd.DataFrame, name: str):
    p = TABDIR / name
    df.drop(columns=[c for c in df.columns if c.startswith("_")], errors="ignore") \
      .to_csv(p, index=False)
    return p
