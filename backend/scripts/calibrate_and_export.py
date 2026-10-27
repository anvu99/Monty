"""
Calibration & Production Model Export Script.

Fits Platt Scaling on the out-of-sample validation fold,
validates calibration quality on the out-of-time test fold,
and exports production artifacts to backend/app/ml/artifacts/.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss, average_precision_score, roc_auc_score
from sklearn.calibration import calibration_curve

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.impulse_service import (
    ALL_FEATURES_MODEL_B,
    ALL_FEATURES_STATIC,
    TARGET_COL,
    add_history_features_dataframe,
    build_personalized_pipeline,
    extract_static_features_dataframe,
    PlattCalibrator,
)


def compute_ece(y_true, y_prob, n_bins: int = 5) -> float:
    """Compute Expected Calibration Error (ECE)."""
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    for i in range(n_bins):
        low, high = bin_edges[i], bin_edges[i+1]
        in_bin = (y_prob >= low) & (y_prob <= high if i == n_bins - 1 else y_prob < high)
        bin_count = np.sum(in_bin)
        if bin_count > 0:
            bin_acc = np.mean(y_true[in_bin])
            bin_conf = np.mean(y_prob[in_bin])
            ece += (bin_count / n) * abs(bin_acc - bin_conf)
    return float(ece)


def main():
    data_path = BASE_DIR / "data" / "training_transactions.csv"
    raw_df = pd.read_csv(data_path)
    
    # 1. Feature Engineering
    static_df = extract_static_features_dataframe(raw_df)
    n = len(static_df)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    
    train_rate = float(static_df.iloc[:train_end][TARGET_COL].astype(int).mean())
    full_df = add_history_features_dataframe(static_df, global_rate=train_rate)
    
    train_df = full_df.iloc[:train_end].copy()
    val_df = full_df.iloc[train_end:val_end].copy()
    test_df = full_df.iloc[val_end:].copy()
    
    X_train = train_df[ALL_FEATURES_MODEL_B]
    y_train = train_df[TARGET_COL].astype(int).to_numpy()
    
    X_val = val_df[ALL_FEATURES_MODEL_B]
    y_val = val_df[TARGET_COL].astype(int).to_numpy()
    
    X_test = test_df[ALL_FEATURES_MODEL_B]
    y_test = test_df[TARGET_COL].astype(int).to_numpy()
    
    # 2. Train Model Pipeline
    print(f"Training Model B Pipeline on {len(X_train)} training rows...")
    pipeline = build_personalized_pipeline(C=2.0)
    pipeline.fit(X_train, y_train)
    
    # 3. Fit Platt Calibrator on Validation Fold
    print(f"Fitting Platt Scaling Calibrator on {len(X_val)} validation rows...")
    raw_val_probs = pipeline.predict_proba(X_val)[:, 1]
    calibrator = PlattCalibrator()
    calibrator.fit(raw_val_probs, y_val)
    
    # 4. Evaluate on Out-of-Time Test Set
    raw_test_probs = pipeline.predict_proba(X_test)[:, 1]
    cal_test_probs = calibrator.predict_proba(raw_test_probs)
    
    # Metrics comparison
    brier_raw = float(brier_score_loss(y_test, raw_test_probs))
    brier_cal = float(brier_score_loss(y_test, cal_test_probs))
    
    ece_raw = compute_ece(y_test, raw_test_probs, n_bins=5)
    ece_cal = compute_ece(y_test, cal_test_probs, n_bins=5)
    
    pr_auc = float(average_precision_score(y_test, cal_test_probs))
    roc_auc = float(roc_auc_score(y_test, cal_test_probs))
    
    # Reliability curve points
    prob_true, prob_pred = calibration_curve(y_test, cal_test_probs, n_bins=5, strategy="uniform")
    reliability_points = [
        {"mean_predicted_prob": round(float(p), 4), "empirical_fraction_positive": round(float(t), 4)}
        for p, t in zip(prob_pred, prob_true)
    ]
    
    print("\n=======================================================")
    print("        PLATT CALIBRATION DIAGNOSTICS (TEST SET)       ")
    print("=======================================================")
    print(f"Brier Score Before Calibration: {brier_raw:.4f}")
    print(f"Brier Score After Calibration:  {brier_cal:.4f}")
    print(f"Expected Calibration Error (ECE) Before: {ece_raw:.4f}")
    print(f"Expected Calibration Error (ECE) After:  {ece_cal:.4f}")
    print(f"Test PR-AUC: {pr_auc:.4f} | ROC-AUC: {roc_auc:.4f}")
    
    print("\nReliability Points (Bin Predicted vs True Fraction):")
    for pt in reliability_points:
        print(f"  Predicted: {pt['mean_predicted_prob']:>6.1%}  -->  Actual Observed: {pt['empirical_fraction_positive']:>6.1%}")
        
    # 5. Export Artifacts
    artifacts_dir = BASE_DIR / "app" / "ml" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = artifacts_dir / "impulse_model_v1.joblib"
    calibrator_path = artifacts_dir / "calibrator_v1.joblib"
    metadata_path = artifacts_dir / "calibration_metadata.json"
    
    joblib.dump(pipeline, model_path)
    joblib.dump(calibrator, calibrator_path)
    
    meta = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "model_version": "v1.0.0",
        "training_period_base_rate": train_rate,
        "test_metrics": {
            "pr_auc": pr_auc,
            "roc_auc": roc_auc,
            "brier_score_raw": brier_raw,
            "brier_score_calibrated": brier_cal,
            "ece_raw": ece_raw,
            "ece_calibrated": ece_cal,
        },
        "reliability_diagram": reliability_points,
        "features": ALL_FEATURES_MODEL_B,
    }
    with open(metadata_path, "w") as f:
        json.dump(meta, f, indent=2)
        
    print(f"\nProduction model exported to:      {model_path}")
    print(f"Platt calibrator exported to:      {calibrator_path}")
    print(f"Calibration metadata exported to:  {metadata_path}")


if __name__ == "__main__":
    main()
