"""
Offline Training & Evaluation Script for Baseline Impulse Predictor (Model A).

Performs:
1. Strict temporal split (70% train / 15% validation / 15% out-of-time test).
2. Point-in-time feature engineering via impulse_service.
3. Hyperparameter tuning (regularization strength C).
4. Evaluation: PR-AUC, ROC-AUC, Brier score, Log-Loss.
5. Feature importance / coefficient extraction.
6. Serialization of trained model pipeline and metadata to app/ml/artifacts/.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
    classification_report,
)

# Add backend directory to sys.path to ensure module imports
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.impulse_service import (
    ALL_FEATURES_STATIC,
    CATEGORICAL_FEATURES_STATIC,
    NUMERIC_FEATURES_STATIC,
    TARGET_COL,
    build_baseline_pipeline,
    extract_static_features_dataframe,
)


def temporal_split(df: pd.DataFrame, train_ratio: float = 0.70, val_ratio: float = 0.15):
    """
    Split time-series transactions strictly by temporal cutoff.
    Ensures zero temporal leakage across train, val, and test partitions.
    """
    sorted_df = df.sort_values("timestamp").reset_index(drop=True)
    n = len(sorted_df)
    
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))
    
    train_df = sorted_df.iloc[:train_end].copy()
    val_df = sorted_df.iloc[train_end:val_end].copy()
    test_df = sorted_df.iloc[val_end:].copy()
    
    return train_df, val_df, test_df


def evaluate_predictions(y_true, y_prob, split_name: str) -> dict:
    """Calculate core classification and probability metrics."""
    pr_auc = float(average_precision_score(y_true, y_prob))
    roc_auc = float(roc_auc_score(y_true, y_prob))
    brier = float(brier_score_loss(y_true, y_prob))
    loss = float(log_loss(y_true, y_prob))
    y_pred = (y_prob >= 0.5).astype(int)
    
    print(f"\n--- {split_name} Performance ---")
    print(f"Sample count:   {len(y_true)} (Positive rate: {np.mean(y_true):.1%})")
    print(f"PR-AUC (Main):  {pr_auc:.4f}")
    print(f"ROC-AUC:        {roc_auc:.4f}")
    print(f"Brier Score:    {brier:.4f}")
    print(f"Log Loss:       {loss:.4f}")
    
    return {
        "count": len(y_true),
        "positive_rate": float(np.mean(y_true)),
        "pr_auc": round(pr_auc, 4),
        "roc_auc": round(roc_auc, 4),
        "brier_score": round(brier, 4),
        "log_loss": round(loss, 4),
    }


def get_feature_importances(pipeline, feature_cols: list) -> list:
    """Extract fitted coefficients matched with transformed feature names."""
    preprocessor = pipeline.named_steps["preprocessor"]
    classifier = pipeline.named_steps["classifier"]
    
    # Get feature names after OneHotEncoding
    cat_encoder = preprocessor.named_transformers_["cat"]
    cat_names = list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES_STATIC))
    transformed_feature_names = NUMERIC_FEATURES_STATIC + cat_names
    
    coefs = classifier.coef_[0]
    importances = []
    for name, coef in zip(transformed_feature_names, coefs):
        importances.append({"feature": name, "coefficient": round(float(coef), 4)})
        
    importances.sort(key=lambda x: abs(x["coefficient"]), reverse=True)
    return importances


def main():
    data_path = BASE_DIR / "data" / "training_transactions.csv"
    if not data_path.exists():
        print(f"Error: Data file not found at {data_path}")
        sys.exit(1)
        
    print(f"Loading data from {data_path}...")
    raw_df = pd.read_csv(data_path)
    print(f"Raw rows loaded: {len(raw_df)}")
    
    # Extract Features
    print("Extracting point-in-time features via impulse_service...")
    feat_df = extract_static_features_dataframe(raw_df)
    print(f"Extracted purchase rows for modeling: {len(feat_df)}")
    
    # Temporal Split
    train_df, val_df, test_df = temporal_split(feat_df, train_ratio=0.70, val_ratio=0.15)
    print("\nStrict Temporal Splitting:")
    print(f"  Train:      {len(train_df)} rows | {train_df['timestamp'].min()} to {train_df['timestamp'].max()}")
    print(f"  Validation: {len(val_df)} rows | {val_df['timestamp'].min()} to {val_df['timestamp'].max()}")
    print(f"  Test:       {len(test_df)} rows | {test_df['timestamp'].min()} to {test_df['timestamp'].max()}")
    
    X_train = train_df[ALL_FEATURES_STATIC]
    y_train = train_df[TARGET_COL].astype(int).to_numpy()
    
    X_val = val_df[ALL_FEATURES_STATIC]
    y_val = val_df[TARGET_COL].astype(int).to_numpy()
    
    X_test = test_df[ALL_FEATURES_STATIC]
    y_test = test_df[TARGET_COL].astype(int).to_numpy()
    
    # Hyperparameter tuning on validation set
    c_candidates = [0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
    best_c = 0.5
    best_val_score = -1.0
    
    print("\nTuning Regularization Parameter C on Validation Set (PR-AUC):")
    for c_val in c_candidates:
        pipe_candidate = build_baseline_pipeline(C=c_val)
        pipe_candidate.fit(X_train, y_train)
        val_probs = pipe_candidate.predict_proba(X_val)[:, 1]
        score = average_precision_score(y_val, val_probs)
        print(f"  C={c_val:<4} -> Val PR-AUC = {score:.4f}")
        if score > best_val_score:
            best_val_score = score
            best_c = c_val
            
    print(f"Selected best C = {best_c} (Val PR-AUC: {best_val_score:.4f})")
    
    # Train final Model A with best C
    final_pipeline = build_baseline_pipeline(C=best_c)
    final_pipeline.fit(X_train, y_train)
    
    val_probs = final_pipeline.predict_proba(X_val)[:, 1]
    val_metrics = evaluate_predictions(y_val, val_probs, "Validation Set")
    
    test_probs = final_pipeline.predict_proba(X_test)[:, 1]
    test_metrics = evaluate_predictions(y_test, test_probs, "Out-of-Time Test Set")
    
    # Feature importances
    factors = get_feature_importances(final_pipeline, ALL_FEATURES_STATIC)
    print("\nTop Predictors (Model A Coefficients):")
    for f in factors[:8]:
        print(f"  {f['feature']:<35} : {f['coefficient']:+.4f}")
        
    # Serialize artifacts
    artifacts_dir = BASE_DIR / "app" / "ml" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = artifacts_dir / "impulse_model_v1.joblib"
    joblib.dump(final_pipeline, model_path)
    print(f"\nModel pipeline saved to: {model_path}")
    
    metadata = {
        "model_name": "Model A (Baseline Static Logistic Regression)",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": len(train_df),
        "validation_rows": len(val_df),
        "test_rows": len(test_df),
        "best_C": best_c,
        "features": ALL_FEATURES_STATIC,
        "validation_metrics": val_metrics,
        "test_metrics": test_metrics,
        "feature_importances": factors,
    }
    
    meta_path = artifacts_dir / "model_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Model metadata saved to: {meta_path}")


if __name__ == "__main__":
    main()
