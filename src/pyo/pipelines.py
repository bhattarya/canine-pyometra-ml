"""CV-safe preprocessing and the model zoo.

Every estimator is wrapped so that imputation / scaling / SMOTE are fitted
inside each training fold only (roadmap step 6). Two families are provided:
  * class-weighted variants  (cost-sensitive learning)
  * SMOTE variants           (synthetic minority over-sampling)
"""
from __future__ import annotations

import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.discriminant_analysis import (
    LinearDiscriminantAnalysis, QuadraticDiscriminantAnalysis,
)
from sklearn.ensemble import (
    AdaBoostClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier,
    RandomForestClassifier, RandomForestRegressor,
)
from sklearn.impute import KNNImputer, SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from xgboost import XGBClassifier

from .config import SEED


# --------------------------------------------------------------------------- #
# Preprocessing
# --------------------------------------------------------------------------- #
def make_preprocessor(numeric, categorical=None, scale=True, imputer="median"):
    """ColumnTransformer: numeric -> impute (+scale); categorical -> one-hot."""
    if imputer == "median":
        num_impute = SimpleImputer(strategy="median")
    elif imputer == "mean":
        num_impute = SimpleImputer(strategy="mean")
    elif imputer == "knn":
        num_impute = KNNImputer(n_neighbors=5)
    else:
        raise ValueError(imputer)

    num_steps = [("impute", num_impute)]
    if scale:
        num_steps.append(("scale", StandardScaler()))
    num_pipe = Pipeline(num_steps)

    transformers = [("num", num_pipe, list(numeric))]
    if categorical:
        cat_pipe = Pipeline([
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("oh", OneHotEncoder(handle_unknown="ignore", drop=None,
                                 sparse_output=False)),
        ])
        transformers.append(("cat", cat_pipe, list(categorical)))
    return ColumnTransformer(transformers, remainder="drop",
                             verbose_feature_names_out=False)


# --------------------------------------------------------------------------- #
# Classifier zoo
# --------------------------------------------------------------------------- #
def _base_classifiers(scaled_ok: bool):
    """Return {name: estimator}. `scaled_ok` toggles the class_weight kwarg
    for models that accept it."""
    cw = "balanced"
    models = {
        "LogReg_L2": LogisticRegression(
            penalty="l2", C=1.0, class_weight=cw, max_iter=5000, solver="lbfgs"),
        "LogReg_L1_LASSO": LogisticRegression(
            penalty="l1", C=0.5, class_weight=cw, max_iter=5000, solver="liblinear"),
        "LogReg_ElasticNet": LogisticRegression(
            penalty="elasticnet", C=0.5, l1_ratio=0.5, class_weight=cw,
            max_iter=5000, solver="saga"),
        "LinearSVM": SVC(kernel="linear", C=1.0, class_weight=cw,
                         probability=True, random_state=SEED, cache_size=500),
        "RBF_SVM": SVC(kernel="rbf", C=1.0, gamma="scale", class_weight=cw,
                       probability=True, random_state=SEED, cache_size=500),
        "LDA": LinearDiscriminantAnalysis(solver="lsqr", shrinkage="auto"),
        "QDA": QuadraticDiscriminantAnalysis(reg_param=0.5),
        "GaussianNB": GaussianNB(),
        "KNN": KNeighborsClassifier(n_neighbors=7),
        "DecisionTree": DecisionTreeClassifier(
            max_depth=3, min_samples_leaf=5, class_weight=cw, random_state=SEED),
        "RandomForest": RandomForestClassifier(
            n_estimators=300, max_depth=4, min_samples_leaf=3,
            class_weight="balanced_subsample", random_state=SEED, n_jobs=-1),
        "AdaBoost": AdaBoostClassifier(n_estimators=150, learning_rate=0.3,
                                       random_state=SEED),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=150, max_depth=2, learning_rate=0.05,
            subsample=0.8, random_state=SEED),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_depth=3, learning_rate=0.05, max_iter=250,
            l2_regularization=1.0, random_state=SEED),
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=2, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, reg_lambda=2.0,
            eval_metric="logloss", random_state=SEED, n_jobs=-1),
    }
    return models


def build_classifier_zoo(numeric, categorical=None, resampling="class_weight",
                         scale=True, imputer="median"):
    """Return {name: fitted-able Pipeline}. resampling in {'class_weight','smote'}."""
    pre = make_preprocessor(numeric, categorical, scale=scale, imputer=imputer)
    zoo = {}
    for name, est in _base_classifiers(scale).items():
        steps = [("pre", pre)]
        if resampling == "smote":
            steps.append(("smote", SMOTE(random_state=SEED, k_neighbors=3)))
            # drop class_weight when using SMOTE to avoid double-correcting
            if hasattr(est, "class_weight"):
                est = est.set_params(class_weight=None)
        steps.append(("clf", est))
        zoo[name] = ImbPipeline(steps) if resampling == "smote" else Pipeline(steps)
    return zoo


# --------------------------------------------------------------------------- #
# Regressor zoo (Days_to_Resolution)
# --------------------------------------------------------------------------- #
def build_regressor_zoo(numeric, categorical=None, scale=True, imputer="median"):
    pre = make_preprocessor(numeric, categorical, scale=scale, imputer=imputer)
    regs = {
        "LinearRegression": LinearRegression(),
        "DecisionTreeReg": DecisionTreeRegressor(
            max_depth=3, min_samples_leaf=5, random_state=SEED),
        "RandomForestReg": RandomForestRegressor(
            n_estimators=600, max_depth=4, min_samples_leaf=3,
            random_state=SEED, n_jobs=-1),
        "KNNReg": KNeighborsRegressor(n_neighbors=7),
    }
    return {name: Pipeline([("pre", pre), ("reg", est)])
            for name, est in regs.items()}
