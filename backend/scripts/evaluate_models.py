"""
Rigorous Model Comparison, Leave-One-Child-Out (LOCO) CV & Bootstrap Uncertainty.

Evaluates:
- Model A: Baseline Static Logistic Regression
- Model B: Personalized History Logistic Regression

Methodology:
1. Temporal split out-of-time evaluation.
2. 1,000-iteration percentile bootstrap for 95% confidence intervals.
3. Leave-One-Child-Out (LOCO) cross-validation for cold-start measurement.
4. Serializes comparison report to app/ml/artifacts/model_comparison_results.json.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
)

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.impulse_service import (
    ALL_FEATURES_MODEL_B,
    ALL_FEATURES_STATIC,
    CATEGORICAL_FEATURES_STATIC,
    NUMERIC_FEATURES_HISTORY,
    NUMERIC_FEATURES_STATIC,
    TARGET_COL,
    add_history_features_dataframe,
    build_baseline_pipeline,
    build_personalized_pipeline,
    extract_static_features_dataframe,
)


def compute_metrics(y_true, y_prob):
    """Return dictionary of core discrimination and calibration metrics."""
    prob_clipped = np.clip(y_prob, 1e-7, 1.0 - 1e-7)
    return {
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "brier_score": float(brier_score_loss(y_true, y_prob)),
        "log_loss": float(log_loss(y_true, prob_clipped)),
    }


def bootstrap_metrics(y_true, y_prob_a, y_prob_b, n_bootstraps: int = 1000, seed: int = 42):
    """
    Run 1,000 bootstrap iterations on the test set.
    Computes 95% Confidence Intervals for Model A, Model B, and the difference (Delta = B - A).
    """
    rng = np.random.default_rng(seed)
    n = len(y_true)
    
    a_pr_aucs, b_pr_aucs, delta_pr_aucs = [], [], []
    a_roc_aucs, b_roc_aucs, delta_roc_aucs = [], [], []
    a_brier, b_brier, delta_brier = [], [], []
    
    for _ in range(n_bootstraps):
        idx = rng.choice(n, size=n, replace=True)
        # Resample must contain at least one positive and one negative
        if len(np.unique(y_true[idx])) < 2:
            continue
            
        y_b = y_true[idx]
        pa = y_prob_a[idx]
        pb = y_prob_b[idx]
        
        # PR-AUC
        score_a_pr = average_precision_score(y_b, pa)
        score_b_pr = average_precision_score(y_b, pb)
        a_pr_aucs.append(score_a_pr)
        b_pr_aucs.append(score_b_pr)
        delta_pr_aucs.append(score_b_pr - score_a_pr)
        
        # ROC-AUC
        score_a_roc = roc_auc_score(y_b, pa)
        score_b_roc = roc_auc_score(y_b, pb)
        a_roc_aucs.append(score_a_roc)
        b_roc_aucs.append(score_b_roc)
        delta_roc_aucs.append(score_b_roc - score_a_roc)
        
        # Brier
        score_a_br = brier_score_loss(y_b, pa)
        score_b_br = brier_score_loss(y_b, pb)
        a_brier.append(score_a_br)
        b_brier.append(score_b_br)
        delta_brier.append(score_b_br - score_a_br)
        
    def ci_dict(arr):
        return {
            "mean": round(float(np.mean(arr)), 4),
            "ci_95_lower": round(float(np.percentile(arr, 2.5)), 4),
            "ci_95_upper": round(float(np.percentile(arr, 97.5)), 4),
        }
        
    return {
        "pr_auc": {
            "model_a": ci_dict(a_pr_aucs),
            "model_b": ci_dict(b_pr_aucs),
            "delta_b_minus_a": ci_dict(delta_pr_aucs),
        },
        "roc_auc": {
            "model_a": ci_dict(a_roc_aucs),
            "model_b": ci_dict(b_roc_aucs),
            "delta_b_minus_a": ci_dict(delta_roc_aucs),
        },
        "brier_score": {
            "model_a": ci_dict(a_brier),
            "model_b": ci_dict(b_brier),
            "delta_b_minus_a": ci_dict(delta_brier),
        },
    }


def run_loco_cv(full_df: pd.DataFrame, c_val: float = 1.0):
    """
    Leave-One-Child-Out (LOCO) Cross-Validation.
    Measures cold-start ability on children the model has never seen.
    """
    children = full_df["child_id"].unique()
    print(f"\n--- Leave-One-Child-Out (LOCO) CV across {len(children)} children ---")
    
    y_all = []
    y_prob_a_all = []
    y_prob_b_all = []
    per_child_summary = {}
    
    for held_out_child in children:
        train_loco = full_df[full_df.child_id != held_out_child].copy()
        test_loco = full_df[full_df.child_id == held_out_child].copy()
        
        pipe_a = build_baseline_pipeline(C=c_val)
        pipe_a.fit(train_loco[ALL_FEATURES_STATIC], train_loco[TARGET_COL].astype(int))
        prob_a = pipe_a.predict_proba(test_loco[ALL_FEATURES_STATIC])[:, 1]
        
        pipe_b = build_personalized_pipeline(C=c_val)
        pipe_b.fit(train_loco[ALL_FEATURES_MODEL_B], train_loco[TARGET_COL].astype(int))
        prob_b = pipe_b.predict_proba(test_loco[ALL_FEATURES_MODEL_B])[:, 1]
        
        y_loco = test_loco[TARGET_COL].astype(int).to_numpy()
        
        y_all.extend(y_loco)
        y_prob_a_all.extend(prob_a)
        y_prob_b_all.extend(prob_b)
        
        pr_a = average_precision_score(y_loco, prob_a)
        pr_b = average_precision_score(y_loco, prob_b)
        per_child_summary[held_out_child] = {
            "rows": len(test_loco),
            "impulse_rate": round(float(np.mean(y_loco)), 3),
            "model_a_pr_auc": round(float(pr_a), 4),
            "model_b_pr_auc": round(float(pr_b), 4),
        }
        print(f"  Child {held_out_child:<8} ({len(test_loco)} rows, {np.mean(y_loco):.1%} imp) -> "
              f"Model A PR-AUC: {pr_a:.4f} | Model B PR-AUC: {pr_b:.4f}")
        
    y_all = np.array(y_all)
    y_prob_a_all = np.array(y_prob_a_all)
    y_prob_b_all = np.array(y_prob_b_all)
    
    loco_metrics_a = compute_metrics(y_all, y_prob_a_all)
    loco_metrics_b = compute_metrics(y_all, y_prob_b_all)
    
    return {
        "model_a_overall": loco_metrics_a,
        "model_b_overall": loco_metrics_b,
        "per_child": per_child_summary,
    }


def main():
    data_path = BASE_DIR / "data" / "training_transactions.csv"
    raw_df = pd.read_csv(data_path)
    
    # 1. Feature Engineering
    static_df = extract_static_features_dataframe(raw_df)
    
    # Temporal Split: 70% Train, 15% Val, 15% Test
    n = len(static_df)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    
    # Global impulse rate strictly from the training period
    train_rate = float(static_df.iloc[:train_end][TARGET_COL].astype(int).mean())
    print(f"Training period impulse base rate: {train_rate:.3f}")
    
    # Add backward history features
    full_df = add_history_features_dataframe(static_df, global_rate=train_rate)
    
    train_df = full_df.iloc[:train_end].copy()
    val_df = full_df.iloc[train_end:val_end].copy()
    test_df = full_df.iloc[val_end:].copy()
    
    # Fit Model A & Model B on Train set
    y_train = train_df[TARGET_COL].astype(int).to_numpy()
    y_val = val_df[TARGET_COL].astype(int).to_numpy()
    y_test = test_df[TARGET_COL].astype(int).to_numpy()
    
    # Train Model A
    pipe_a = build_baseline_pipeline(C=2.0)
    pipe_a.fit(train_df[ALL_FEATURES_STATIC], y_train)
    prob_a_test = pipe_a.predict_proba(test_df[ALL_FEATURES_STATIC])[:, 1]
    
    # Train Model B
    pipe_b = build_personalized_pipeline(C=2.0)
    pipe_b.fit(train_df[ALL_FEATURES_MODEL_B], y_train)
    prob_b_test = pipe_b.predict_proba(test_df[ALL_FEATURES_MODEL_B])[:, 1]
    
    # 2. Out-of-Time Test Metrics
    metrics_a = compute_metrics(y_test, prob_a_test)
    metrics_b = compute_metrics(y_test, prob_b_test)
    
    print("\n=======================================================")
    print("      OUT-OF-TIME TEST SET EVALUATION (36 ROWS)       ")
    print("=======================================================")
    print(f"{'Metric':<15} | {'Model A (Static)':<18} | {'Model B (Personalized)':<22} | {'Lift (B - A)':<12}")
    print("-" * 75)
    for m in ["pr_auc", "roc_auc", "brier_score", "log_loss"]:
        val_a = metrics_a[m]
        val_b = metrics_b[m]
        diff = val_b - val_a
        sign = "+" if diff > 0 else ""
        print(f"{m.upper():<15} | {val_a:<18.4f} | {val_b:<22.4f} | {sign}{diff:<12.4f}")
        
    # 3. 1,000 Bootstrap Iterations
    print("\nRunning 1,000 Bootstrap Resamples for 95% Confidence Intervals...")
    boot_results = bootstrap_metrics(y_test, prob_a_test, prob_b_test, n_bootstraps=1000)
    
    print("\n95% Bootstrap Confidence Intervals:")
    pr_ci = boot_results["pr_auc"]
    print(f"  Model A PR-AUC: {pr_ci['model_a']['mean']:.4f} [95% CI: {pr_ci['model_a']['ci_95_lower']:.4f} – {pr_ci['model_a']['ci_95_upper']:.4f}]")
    print(f"  Model B PR-AUC: {pr_ci['model_b']['mean']:.4f} [95% CI: {pr_ci['model_b']['ci_95_lower']:.4f} – {pr_ci['model_b']['ci_95_upper']:.4f}]")
    delta_ci = pr_ci["delta_b_minus_a"]
    print(f"  Delta (B - A):  {delta_ci['mean']:+.4f} [95% CI: {delta_ci['ci_95_lower']:+.4f} – {delta_ci['ci_95_upper']:+.4f}]")
    
    stat_sig = "YES (Significant)" if (delta_ci["ci_95_lower"] > 0 or delta_ci["ci_95_upper"] < 0) else "NO (Interval includes 0; statistically indistinguishable)"
    print(f"  Statistically Significant Lift? -> {stat_sig}")
    
    # 4. LOCO Cross-Validation
    loco_results = run_loco_cv(full_df, c_val=2.0)
    print("\nOverall Leave-One-Child-Out (LOCO) Summary:")
    print(f"  Model A Overall PR-AUC: {loco_results['model_a_overall']['pr_auc']:.4f} | ROC-AUC: {loco_results['model_a_overall']['roc_auc']:.4f} | Brier: {loco_results['model_a_overall']['brier_score']:.4f}")
    print(f"  Model B Overall PR-AUC: {loco_results['model_b_overall']['pr_auc']:.4f} | ROC-AUC: {loco_results['model_b_overall']['roc_auc']:.4f} | Brier: {loco_results['model_b_overall']['brier_score']:.4f}")
    
    # 5. Extract Model B Feature Importances
    preprocessor = pipe_b.named_steps["preprocessor"]
    cat_names = list(preprocessor.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_FEATURES_STATIC))
    all_feature_names = (NUMERIC_FEATURES_STATIC + NUMERIC_FEATURES_HISTORY) + cat_names
    coefs_b = pipe_b.named_steps["classifier"].coef_[0]
    
    importances_b = [
        {"feature": name, "coefficient": round(float(c), 4)}
        for name, c in zip(all_feature_names, coefs_b)
    ]
    importances_b.sort(key=lambda x: abs(x["coefficient"]), reverse=True)
    
    print("\nTop 10 Predictors for Model B (Personalized LR):")
    for item in importances_b[:10]:
        print(f"  {item['feature']:<35} : {item['coefficient']:+.4f}")
        
    # Serialize results to json
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "out_of_time_metrics": {
            "model_a": metrics_a,
            "model_b": metrics_b,
        },
        "bootstrap_95_ci": boot_results,
        "is_statistically_significant": bool(delta_ci["ci_95_lower"] > 0 or delta_ci["ci_95_upper"] < 0),
        "loco_cv": loco_results,
        "model_b_coefficients": importances_b,
    }
    
    artifacts_dir = BASE_DIR / "app" / "ml" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    
    # Save Model B pipeline
    model_b_path = artifacts_dir / "impulse_model_b_v1.joblib"
    import joblib
    joblib.dump(pipe_b, model_b_path)
    print(f"\nModel B pipeline saved to: {model_b_path}")
    
    out_file = artifacts_dir / "model_comparison_results.json"
    with open(out_file, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Full comparison report saved to: {out_file}")


if __name__ == "__main__":
    main()
