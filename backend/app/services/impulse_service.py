"""
Impulse-Purchase Prediction Service and Feature Engineering.

This module provides the unified point-in-time feature extraction pipeline
used both during offline training and real-time inference.
Grounded in the Monty Impulse-Purchase Predictor Implementation Plan.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Feature Definitions for Model A (Static Click-Time Features)
NUMERIC_FEATURES_STATIC = [
    "amount",
    "goal_progress",
    "amt_to_savings",
    "amt_to_remaining_goal",
    "days_since_last_deposit",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
]

CATEGORICAL_FEATURES_STATIC = [
    "merchant_category",
]

ALL_FEATURES_STATIC = NUMERIC_FEATURES_STATIC + CATEGORICAL_FEATURES_STATIC

# Feature Definitions for Model B (Personalized History Features)
NUMERIC_FEATURES_HISTORY = [
    "spend_24h",
    "spend_7d",
    "purch_last_hour",
    "hours_since_last_purchase",
    "n_prior_purchases",
    "child_rate",
    "child_cat_rate",
    "logit_child_rate",
]

ALL_FEATURES_MODEL_B = ALL_FEATURES_STATIC + NUMERIC_FEATURES_HISTORY
TARGET_COL = "is_impulsive"

STANDARD_CATEGORIES = [
    "Snacks & Treats",
    "Gaming & In-App",
    "Books & Learning",
    "Toys & Hobbies",
    "Sports & Outdoors",
    "Food & Dining",
    "Apparel",
    "General Retail",
    "Other",
]


def normalize_category(raw_cat: Optional[str]) -> str:
    """Normalize merchant or purchase category into standard classes."""
    if not raw_cat or not isinstance(raw_cat, str):
        return "Other"
    
    clean = raw_cat.strip()
    # Normalize known aliases
    if clean in ("Food & Drink", "Snacks", "Candy", "Fast Food"):
        return "Snacks & Treats"
    if clean in ("Gaming", "Video Games", "Apps"):
        return "Gaming & In-App"
    if clean in ("Education", "Books", "School"):
        return "Books & Learning"
    if clean in ("Toys", "Hobbies", "Collectibles"):
        return "Toys & Hobbies"
    if clean in ("Sports", "Fitness", "Outdoors"):
        return "Sports & Outdoors"
    if clean in ("Dining", "Restaurant"):
        return "Food & Dining"
    if clean in ("Clothing", "Shoes", "Fashion"):
        return "Apparel"
    
    for standard in STANDARD_CATEGORIES:
        if standard.lower() == clean.lower():
            return standard
            
    return clean


def infer_category(category: Optional[str] = None, merchant: Optional[str] = None, product_name: Optional[str] = None) -> str:
    """Infer or normalize category using category string, merchant, and product keywords."""
    cat = normalize_category(category)
    if cat not in ("Other", "") and cat != (category or "").strip():
        return cat
    
    # Try keywords from product_name and merchant if category is generic or unknown
    text = f"{product_name or ''} {category or ''} {merchant or ''}".lower()
    if any(k in text for k in ("candy", "gummy", "chocolate", "snack", "cookie", "treat", "boba", "soda")):
        return "Snacks & Treats"
    if any(k in text for k in ("game", "robux", "steam", "playstation", "xbox", "nintendo", "v-bucks", "skin", "in-app")):
        return "Gaming & In-App"
    if any(k in text for k in ("book", "course", "lesson", "pen", "notebook", "school")):
        return "Books & Learning"
    if any(k in text for k in ("lego", "toy", "figure", "doll", "puzzle", "plush", "card")):
        return "Toys & Hobbies"
    if any(k in text for k in ("ball", "cleats", "jersey", "shoe", "sport", "fitness")):
        return "Sports & Outdoors"
    if any(k in text for k in ("shirt", "pants", "hoodie", "dress", "jacket", "apparel", "clothing")):
        return "Apparel"
        
    return cat if cat != "Other" else "General Retail"


def extract_static_features_dataframe(
    df: pd.DataFrame,
    default_days_since_deposit: float = 14.0
) -> pd.DataFrame:
    """
    Extract click-time static features for offline dataset.
    
    CRITICAL ML SAFETY RULE:
    Strictly backward-looking with pd.merge_asof. Future deposits or transactions
    CANNOT be matched to earlier purchases.
    """
    data = df.copy()
    
    # Ensure datetime parsing with UTC
    if not pd.api.types.is_datetime64_any_dtype(data["timestamp"]):
        data["timestamp"] = pd.to_datetime(data["timestamp"], utc=True)
    
    # Split deposits from spending purchases
    is_dep = data["is_deposit"].astype(bool)
    deposits = data[is_dep].copy()
    purchases = data[~is_dep].copy()
    
    # Ensure strict sorting by timestamp for merge_asof
    deposits = deposits.sort_values("timestamp").reset_index(drop=True)
    purchases = purchases.sort_values("timestamp").reset_index(drop=True)
    
    # Compute days_since_last_deposit using merge_asof (backward strictly)
    if not deposits.empty:
        dep_subset = deposits[["child_id", "timestamp"]].copy().rename(
            columns={"timestamp": "last_deposit_ts"}
        )
        merged = pd.merge_asof(
            purchases,
            dep_subset,
            left_on="timestamp",
            right_on="last_deposit_ts",
            by="child_id",
            direction="backward",
            allow_exact_matches=False  # Strict inequality: deposit must precede purchase
        )
        
        # Calculate elapsed days
        delta = (merged["timestamp"] - merged["last_deposit_ts"]).dt.total_seconds() / 86400.0
        merged["days_since_last_deposit"] = delta.fillna(default_days_since_deposit).clip(0.0, 180.0)
    else:
        merged = purchases.copy()
        merged["days_since_last_deposit"] = default_days_since_deposit
    
    # Compute Point-In-Time ratios
    cur_savings = merged["current_savings_at_time"].astype(float).clip(lower=0.0)
    goal_target = merged["goal_target_amount"].astype(float).clip(lower=1.0)
    amt = merged["amount"].astype(float).clip(lower=0.01)
    
    # 1. Goal Progress: savings / target
    merged["goal_progress"] = (cur_savings / goal_target).clip(0.0, 5.0)
    
    # 2. Amount relative to current savings
    merged["amt_to_savings"] = (amt / np.maximum(cur_savings, 1.0)).clip(0.0, 20.0)
    
    # 3. Amount relative to remaining goal deficit
    remaining_goal = np.maximum(goal_target - cur_savings, 1.0)
    merged["amt_to_remaining_goal"] = (amt / remaining_goal).clip(0.0, 20.0)
    
    # 4. Temporal Click-time signals
    ts = merged["timestamp"]
    merged["hour_of_day"] = ts.dt.hour
    merged["day_of_week"] = ts.dt.day_of_week
    merged["is_weekend"] = (ts.dt.day_of_week >= 5).astype(int)
    
    # 5. Normalized merchant category
    merged["merchant_category"] = merged["merchant_category"].apply(normalize_category)
    
    # Keep required feature columns + metadata for splitting
    meta_cols = ["child_id", "timestamp", "is_impulsive"]
    if "is_impulsive" not in merged.columns:
        meta_cols.remove("is_impulsive")
        
    output_cols = meta_cols + ALL_FEATURES_STATIC
    return merged[output_cols].sort_values("timestamp").reset_index(drop=True)


def extract_point_in_time_features(
    child_id: str,
    amount: float,
    merchant_category: str,
    timestamp: datetime,
    current_savings: float,
    goal_target: float,
    last_deposit_timestamp: Optional[datetime] = None,
    default_days_since_deposit: float = 14.0
) -> pd.DataFrame:
    """
    Extract the exact same click-time features for a single real-time inference request.
    Returns a 1-row DataFrame ready for model pipeline input.
    """
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
        
    cur_sav = max(float(current_savings), 0.0)
    gt = max(float(goal_target), 1.0)
    amt = max(float(amount), 0.01)
    
    # Calculate days since last deposit
    if last_deposit_timestamp is not None:
        if last_deposit_timestamp.tzinfo is None:
            last_deposit_timestamp = last_deposit_timestamp.replace(tzinfo=timezone.utc)
        delta_sec = (timestamp - last_deposit_timestamp).total_seconds()
        days_since_dep = max(0.0, min(delta_sec / 86400.0, 180.0))
    else:
        days_since_dep = default_days_since_deposit
        
    goal_prog = min(cur_sav / gt, 5.0)
    amt_to_sav = min(amt / max(cur_sav, 1.0), 20.0)
    remaining_goal = max(gt - cur_sav, 1.0)
    amt_to_rem = min(amt / remaining_goal, 20.0)
    
    row = {
        "amount": amt,
        "goal_progress": goal_prog,
        "amt_to_savings": amt_to_sav,
        "amt_to_remaining_goal": amt_to_rem,
        "days_since_last_deposit": days_since_dep,
        "hour_of_day": timestamp.hour,
        "day_of_week": timestamp.weekday(),
        "is_weekend": int(timestamp.weekday() >= 5),
        "merchant_category": normalize_category(merchant_category),
    }
    
    return pd.DataFrame([row])[ALL_FEATURES_STATIC]


def build_baseline_pipeline(C: float = 0.5) -> Pipeline:
    """
    Build Scikit-Learn Pipeline for Model A (Baseline Regularized Logistic Regression).
    StandardScaler on numeric signals, OneHotEncoder on categories.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                StandardScaler(),
                NUMERIC_FEATURES_STATIC,
            ),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES_STATIC,
            ),
        ]
    )
    
    classifier = LogisticRegression(
        C=C,
        solver="lbfgs",
        max_iter=2000,
        random_state=42,
        class_weight="balanced",  # Accounts for class imbalance
    )
    
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )
    return pipeline


def add_history_features_dataframe(
    df: pd.DataFrame,
    global_rate: float = 0.64,
    k_child: float = 10.0,
    k_cat: float = 5.0,
) -> pd.DataFrame:
    """
    Extract personalized historical features (Model B).
    
    CRITICAL ML SAFETY RULE:
    Strictly backward-looking. For purchase row i of a child, features are computed
    STRICTLY from purchases 0 to i-1. Purchase i and future rows are NEVER visible.
    """
    data = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(data["timestamp"]):
        data["timestamp"] = pd.to_datetime(data["timestamp"], utc=True)
        
    records = []
    
    # Process child by child
    for child_id, child_df in data.groupby("child_id", sort=False):
        cdf = child_df.sort_values("timestamp").reset_index(drop=True)
        n = len(cdf)
        
        # Pre-extract arrays for speed and exact indexing
        timestamps = cdf["timestamp"].to_numpy()
        amounts = cdf["amount"].to_numpy(dtype=float)
        labels = cdf[TARGET_COL].astype(int).to_numpy() if TARGET_COL in cdf.columns else np.zeros(n, dtype=int)
        categories = cdf["merchant_category"].to_numpy()
        
        # Arrays to hold computed features
        spend_24h = np.zeros(n, dtype=float)
        spend_7d = np.zeros(n, dtype=float)
        purch_last_hour = np.zeros(n, dtype=int)
        hours_since_last = np.full(n, 168.0, dtype=float)  # default 1 week
        n_prior = np.zeros(n, dtype=int)
        child_rates = np.zeros(n, dtype=float)
        child_cat_rates = np.zeros(n, dtype=float)
        logit_child_rates = np.zeros(n, dtype=float)
        
        for i in range(n):
            if i == 0:
                # First purchase for this child: cold start defaults
                child_rates[i] = global_rate
                child_cat_rates[i] = global_rate
                clipped = np.clip(global_rate, 0.01, 0.99)
                logit_child_rates[i] = np.log(clipped / (1.0 - clipped))
                continue
                
            cur_ts = timestamps[i]
            cur_cat = categories[i]
            
            # Prior items strictly: 0 to i-1
            prev_ts = timestamps[:i]
            prev_amounts = amounts[:i]
            prev_labels = labels[:i]
            prev_cats = categories[:i]
            
            # 1. Rolling window spend (past 24h & 7d)
            delta_sec = (cur_ts - prev_ts).astype("timedelta64[s]").astype(float)
            in_24h = delta_sec <= 86400.0
            in_7d = delta_sec <= 7 * 86400.0
            in_1h = delta_sec <= 3600.0
            
            spend_24h[i] = np.sum(prev_amounts[in_24h])
            spend_7d[i] = np.sum(prev_amounts[in_7d])
            purch_last_hour[i] = int(np.sum(in_1h))
            hours_since_last[i] = delta_sec[-1] / 3600.0
            
            # 2. Bayesian smoothed child-level impulse rate
            n_prior[i] = i
            impulsive_count = np.sum(prev_labels)
            smoothed_rate = (k_child * global_rate + impulsive_count) / (k_child + i)
            child_rates[i] = smoothed_rate
            
            # 3. Category-level Bayesian smoothed rate
            cat_mask = (prev_cats == cur_cat)
            n_cat = np.sum(cat_mask)
            imp_cat = np.sum(prev_labels[cat_mask])
            cat_smoothed = (k_cat * smoothed_rate + imp_cat) / (k_cat + n_cat)
            child_cat_rates[i] = cat_smoothed
            
            # 4. Logit transform for linear models
            clipped_rate = np.clip(smoothed_rate, 0.01, 0.99)
            logit_child_rates[i] = np.log(clipped_rate / (1.0 - clipped_rate))
            
        cdf["spend_24h"] = spend_24h
        cdf["spend_7d"] = spend_7d
        cdf["purch_last_hour"] = purch_last_hour
        cdf["hours_since_last_purchase"] = hours_since_last
        cdf["n_prior_purchases"] = n_prior
        cdf["child_rate"] = child_rates
        cdf["child_cat_rate"] = child_cat_rates
        cdf["logit_child_rate"] = logit_child_rates
        records.append(cdf)
        
    res = pd.concat(records, ignore_index=True)
    return res.sort_values("timestamp").reset_index(drop=True)


def build_personalized_pipeline(C: float = 0.5) -> Pipeline:
    """
    Build Scikit-Learn Pipeline for Model B (Personalized Regularized Logistic Regression).
    StandardScaler on static + dynamic history signals, OneHotEncoder on categories.
    """
    all_num = NUMERIC_FEATURES_STATIC + NUMERIC_FEATURES_HISTORY
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                StandardScaler(),
                all_num,
            ),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES_STATIC,
            ),
        ]
    )
    
    classifier = LogisticRegression(
        C=C,
        solver="lbfgs",
        max_iter=2000,
        random_state=42,
        class_weight="balanced",
    )
    
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )
    return pipeline


class PlattCalibrator:
    """
    Platt Scaling Calibrator.
    Maps raw probability predictions to calibrated probabilities via 1D logistic regression
    fitted on log-odds: P_cal = sigmoid(a * logit(p_raw) + b).
    """
    def __init__(self):
        self.calibrator = LogisticRegression(solver="lbfgs", random_state=42)
        self.is_fitted = False

    def fit(self, raw_probs: np.ndarray, y_true: np.ndarray):
        clipped = np.clip(raw_probs, 1e-4, 1.0 - 1e-4)
        logits = np.log(clipped / (1.0 - clipped)).reshape(-1, 1)
        self.calibrator.fit(logits, y_true)
        self.is_fitted = True
        return self

    def predict_proba(self, raw_probs: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            return np.asarray(raw_probs, dtype=float)
        clipped = np.clip(raw_probs, 1e-4, 1.0 - 1e-4)
        logits = np.log(clipped / (1.0 - clipped)).reshape(-1, 1)
        return self.calibrator.predict_proba(logits)[:, 1]


_LOADED_MODEL = None
_LOADED_CALIBRATOR = None


def get_production_model():
    """Load and cache the trained Model B pipeline and Platt calibrator."""
    global _LOADED_MODEL, _LOADED_CALIBRATOR
    if _LOADED_MODEL is None:
        import joblib
        artifacts_dir = Path(__file__).resolve().parent.parent / "ml" / "artifacts"
        model_path = artifacts_dir / "impulse_model_v1.joblib"
        cal_path = artifacts_dir / "calibrator_v1.joblib"
        
        if model_path.exists():
            _LOADED_MODEL = joblib.load(model_path)
        if cal_path.exists():
            _LOADED_CALIBRATOR = joblib.load(cal_path)
            
    return _LOADED_MODEL, _LOADED_CALIBRATOR


def score_transaction(
    db: Any,
    child_id: str,
    amount: float,
    merchant: str,
    product_name: str,
    category: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """
    Real-time impulse prediction (<10ms).
    
    1. Extracts point-in-time financial and historical features from DB state.
    2. Runs model pipeline + Platt calibrator.
    3. Persists assessment to impulse_scores table.
    4. Returns calibrated risk_score, risk_level, and top contributing factors.
    """
    from app.models import Child, SavingsGoal, Transaction, ImpulseScore
    from app.services.coaching_service import risk_level as get_risk_level
    
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    elif timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
        
    norm_category = infer_category(category, merchant, product_name)
    amount = float(amount)
    
    # 1. Fetch child and goal status from DB
    child = db.get(Child, child_id) if hasattr(db, "get") else None
    
    # Active savings goal
    goal = None
    if hasattr(db, "query"):
        goal = db.query(SavingsGoal).filter_by(child_id=child_id, status="active").first()
        
    goal_target = float(goal.target_amount) if goal else 100.0
    current_savings = float(goal.current_amount) if goal else 30.0
    
    # Most recent deposit
    last_dep_ts = None
    if hasattr(db, "query"):
        last_dep = (
            db.query(Transaction)
            .filter(Transaction.child_id == child_id, Transaction.is_deposit.is_(True))
            .order_by(Transaction.timestamp.desc())
            .first()
        )
        if last_dep:
            last_dep_ts = last_dep.timestamp
            
    # Calculate static click-time signals
    days_since_dep = 14.0
    if last_dep_ts:
        if last_dep_ts.tzinfo is None:
            last_dep_ts = last_dep_ts.replace(tzinfo=timezone.utc)
        days_since_dep = max(0.0, min((timestamp - last_dep_ts).total_seconds() / 86400.0, 180.0))
        
    goal_progress = min(current_savings / max(goal_target, 1.0), 5.0)
    amt_to_savings = min(amount / max(current_savings, 1.0), 20.0)
    amt_to_remaining = min(amount / max(goal_target - current_savings, 1.0), 20.0)
    
    # 2. Calculate child history features
    spend_24h = 0.0
    spend_7d = 0.0
    purch_last_hour = 0
    hours_since_last = 168.0
    n_prior = 0
    child_rate = 0.625
    child_cat_rate = 0.625
    
    if hasattr(db, "query"):
        past_txs = (
            db.query(Transaction)
            .filter(
                Transaction.child_id == child_id,
                Transaction.is_deposit.is_(False),
                Transaction.timestamp < timestamp,
            )
            .order_by(Transaction.timestamp.asc())
            .all()
        )
        if past_txs:
            n_prior = len(past_txs)
            prev_ts = [t.timestamp.replace(tzinfo=timezone.utc) if t.timestamp.tzinfo is None else t.timestamp for t in past_txs]
            prev_amts = [float(t.amount) for t in past_txs]
            
            hours_since_last = (timestamp - prev_ts[-1]).total_seconds() / 3600.0
            
            for t_prev, a_prev in zip(prev_ts, prev_amts):
                diff_sec = (timestamp - t_prev).total_seconds()
                if diff_sec <= 86400.0:
                    spend_24h += a_prev
                if diff_sec <= 7 * 86400.0:
                    spend_7d += a_prev
                if diff_sec <= 3600.0:
                    purch_last_hour += 1
                    
        # History impulse scores
        prior_scores = (
            db.query(ImpulseScore)
            .filter(ImpulseScore.child_id == child_id, ImpulseScore.timestamp < timestamp)
            .all()
        )
        if prior_scores:
            n_scores = len(prior_scores)
            imp_scores_count = sum(1 for s in prior_scores if (s.impulse_score or 0) >= 50.0)
            child_rate = (10.0 * 0.625 + imp_scores_count) / (10.0 + n_scores)
            
            cat_scores = [s for s in prior_scores if s.merchant_category == norm_category]
            n_cat = len(cat_scores)
            imp_cat_count = sum(1 for s in cat_scores if (s.impulse_score or 0) >= 50.0)
            child_cat_rate = (5.0 * child_rate + imp_cat_count) / (5.0 + n_cat)
            
    clipped_rate = np.clip(child_rate, 0.01, 0.99)
    logit_child_rate = float(np.log(clipped_rate / (1.0 - clipped_rate)))
    
    # 3. Construct Feature Row
    feature_dict = {
        "amount": amount,
        "goal_progress": goal_progress,
        "amt_to_savings": amt_to_savings,
        "amt_to_remaining_goal": amt_to_remaining,
        "days_since_last_deposit": days_since_dep,
        "hour_of_day": timestamp.hour,
        "day_of_week": timestamp.weekday(),
        "is_weekend": int(timestamp.weekday() >= 5),
        "merchant_category": norm_category,
        "spend_24h": spend_24h,
        "spend_7d": spend_7d,
        "purch_last_hour": purch_last_hour,
        "hours_since_last_purchase": hours_since_last,
        "n_prior_purchases": n_prior,
        "child_rate": child_rate,
        "child_cat_rate": child_cat_rate,
        "logit_child_rate": logit_child_rate,
    }
    feature_row = pd.DataFrame([feature_dict])[ALL_FEATURES_MODEL_B]
    
    # 4. Predict probability
    pipeline, calibrator = get_production_model()
    if pipeline is not None:
        raw_prob = float(pipeline.predict_proba(feature_row)[0, 1])
        if calibrator is not None:
            calibrated_prob = float(calibrator.predict_proba(np.array([raw_prob]))[0])
        else:
            calibrated_prob = raw_prob
    else:
        # Heuristic fallback if model not loaded
        calibrated_prob = 0.50
        
    score_100 = round(float(calibrated_prob * 100.0), 1)
    risk_level_str = get_risk_level(score_100)
    
    # 5. Extract Explanatory Factors
    factors = []
    if norm_category in ("Gaming & In-App", "Snacks & Treats", "Toys & Hobbies"):
        factors.append({
            "factor": f"High-risk Category: {norm_category}",
            "contribution": 0.35,
            "description": f"Purchases in {norm_category} have historically high impulse rates for kids.",
            "evidence_refs": ["proposed_purchase.category"],
        })
    if amt_to_savings >= 0.5:
        factors.append({
            "factor": "High Impact on Savings",
            "contribution": 0.25,
            "description": f"Cost of ${amount:.2f} takes a significant portion of current savings (${current_savings:.2f}).",
            "evidence_refs": ["goals"],
        })
    if timestamp.hour >= 18 or timestamp.hour < 6:
        factors.append({
            "factor": "Evening / Late-Night Browsing",
            "contribution": 0.20,
            "description": "Late day spending decisions are more frequently impulsive.",
            "evidence_refs": ["coverage.window_end"],
        })
    if child_rate >= 0.70:
        factors.append({
            "factor": "Personal Impulse Pattern",
            "contribution": 0.20,
            "description": f"Child shows a higher historical frequency of unplanned purchases ({child_rate:.0%}).",
            "evidence_refs": ["impulse_summary"],
        })
        
    if not factors:
        factors.append({
            "factor": f"Category Impact: {norm_category}",
            "contribution": 0.15,
            "description": f"Purchase belongs to {norm_category} with standard risk level.",
            "evidence_refs": ["proposed_purchase.category"],
        })
        
    factors_dict = {f["factor"]: f["contribution"] for f in factors}
    
    # Determine alert trigger
    alert_triggered = score_100 >= 60.0
    alert_type = "impulse_pause" if score_100 >= 75.0 else ("warning" if alert_triggered else "none")
    
    # 6. Save to DB
    score_id = None
    if save_to_db and hasattr(db, "add"):
        record = ImpulseScore(
            child_id=child_id,
            product_name=product_name[:100],
            amount=amount,
            merchant_name=merchant[:100],
            merchant_category=norm_category[:50],
            impulse_score=score_100,
            factors=factors_dict,
            alert_triggered=alert_triggered,
            alert_type=alert_type,
            timestamp=timestamp,
        )
        db.add(record)
        try:
            db.commit()
            db.refresh(record)
            score_id = record.id
        except Exception:
            db.rollback()
            
    return {
        "score_id": score_id,
        "child_id": child_id,
        "product_name": product_name,
        "amount": amount,
        "merchant": merchant,
        "category": norm_category,
        "impulse_score": score_100,
        "risk_level": risk_level_str,
        "alert_triggered": alert_triggered,
        "alert_type": alert_type,
        "factors": factors,
        "timestamp": timestamp.isoformat(),
    }


