"""
Unit tests for Impulse-Purchase feature extractor and temporal leakage prevention.

Verifies:
1. No future information leakage (future deposits/transactions never affect past rows).
2. Point-in-time consistency between batch DataFrame and single-row online extractor.
3. Pipeline train/predict integrity.
"""

from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd
import pytest

from app.services.impulse_service import (
    extract_static_features_dataframe,
    extract_point_in_time_features,
    build_baseline_pipeline,
    ALL_FEATURES_STATIC,
    NUMERIC_FEATURES_STATIC,
    CATEGORICAL_FEATURES_STATIC,
    normalize_category,
)


def test_normalize_category():
    """Verify category normalization maps common aliases."""
    assert normalize_category("Food & Drink") == "Snacks & Treats"
    assert normalize_category("Gaming") == "Gaming & In-App"
    assert normalize_category("Books") == "Books & Learning"
    assert normalize_category("Unknown Vendor") == "Unknown Vendor"
    assert normalize_category(None) == "Other"


def test_no_temporal_leakage_from_future_deposits():
    """
    Critical ML Test:
    Future deposits must NEVER affect earlier purchases.
    """
    t0 = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
    t1_purchase = t0 + timedelta(days=2)  # Oct 3, 10:00
    t2_deposit = t0 + timedelta(days=5)   # Oct 6, 10:00 (FUTURE deposit)
    
    # Dataset without future deposit
    df_past_only = pd.DataFrame([
        {
            "child_id": "child_A",
            "timestamp": t0,
            "is_deposit": True,
            "amount": 20.0,
            "current_savings_at_time": 20.0,
            "goal_target_amount": 100.0,
            "merchant_category": "Allowance & Earnings",
            "is_impulsive": False,
        },
        {
            "child_id": "child_A",
            "timestamp": t1_purchase,
            "is_deposit": False,
            "amount": 5.0,
            "current_savings_at_time": 20.0,
            "goal_target_amount": 100.0,
            "merchant_category": "Snacks & Treats",
            "is_impulsive": True,
        }
    ])
    
    # Dataset WITH future deposit added
    df_with_future = pd.concat([
        df_past_only,
        pd.DataFrame([{
            "child_id": "child_A",
            "timestamp": t2_deposit,
            "is_deposit": True,
            "amount": 50.0,
            "current_savings_at_time": 65.0,
            "goal_target_amount": 100.0,
            "merchant_category": "Allowance & Earnings",
            "is_impulsive": False,
        }])
    ], ignore_index=True)
    
    feat_past = extract_static_features_dataframe(df_past_only)
    feat_with_future = extract_static_features_dataframe(df_with_future)
    
    # Features for the purchase at t1 must be EXACTLY identical
    row_past = feat_past[feat_past.timestamp == t1_purchase].iloc[0]
    row_future = feat_with_future[feat_with_future.timestamp == t1_purchase].iloc[0]
    
    for col in ALL_FEATURES_STATIC:
        assert row_past[col] == row_future[col], (
            f"Temporal leakage detected on feature '{col}'! "
            f"Past: {row_past[col]}, With future deposit: {row_future[col]}"
        )
        
    # Specifically check days_since_last_deposit is 2.0 days (Oct 3 - Oct 1), NOT negative or based on Oct 6
    assert abs(row_past["days_since_last_deposit"] - 2.0) < 1e-4


def test_point_in_time_online_consistency():
    """
    Verify single-row extractor gives identical result to batch DataFrame extractor.
    """
    ts = datetime(2026, 10, 5, 14, 30, 0, tzinfo=timezone.utc)
    last_dep = ts - timedelta(days=3.5)
    
    # Single-row online extractor
    online_df = extract_point_in_time_features(
        child_id="child_test",
        amount=15.0,
        merchant_category="Gaming",
        timestamp=ts,
        current_savings=50.0,
        goal_target=200.0,
        last_deposit_timestamp=last_dep
    )
    
    # Batch DataFrame extractor
    batch_raw = pd.DataFrame([
        {
            "child_id": "child_test",
            "timestamp": last_dep,
            "is_deposit": True,
            "amount": 25.0,
            "current_savings_at_time": 25.0,
            "goal_target_amount": 200.0,
            "merchant_category": "Allowance & Earnings",
            "is_impulsive": False,
        },
        {
            "child_id": "child_test",
            "timestamp": ts,
            "is_deposit": False,
            "amount": 15.0,
            "current_savings_at_time": 50.0,
            "goal_target_amount": 200.0,
            "merchant_category": "Gaming",
            "is_impulsive": True,
        }
    ])
    batch_feat = extract_static_features_dataframe(batch_raw)
    batch_row = batch_feat[batch_feat.timestamp == ts].iloc[0]
    
    for col in ALL_FEATURES_STATIC:
        val_online = online_df[col].iloc[0]
        val_batch = batch_row[col]
        if isinstance(val_online, (int, float, np.floating)):
            assert abs(val_online - val_batch) < 1e-4, f"Mismatch on {col}: online={val_online}, batch={val_batch}"
        else:
            assert val_online == val_batch, f"Mismatch on {col}: online={val_online}, batch={val_batch}"


def test_pipeline_train_and_predict():
    """Verify that build_baseline_pipeline trains and produces valid probabilities."""
    pipe = build_baseline_pipeline(C=1.0)
    
    X = pd.DataFrame({
        "amount": [5.0, 10.0, 2.5, 45.0],
        "goal_progress": [0.2, 0.8, 0.5, 0.1],
        "amt_to_savings": [0.25, 0.1, 0.05, 1.5],
        "amt_to_remaining_goal": [0.06, 0.5, 0.05, 0.9],
        "days_since_last_deposit": [1.0, 14.0, 3.0, 25.0],
        "hour_of_day": [15, 20, 14, 23],
        "day_of_week": [1, 5, 2, 6],
        "is_weekend": [0, 1, 0, 1],
        "merchant_category": ["Snacks & Treats", "Gaming & In-App", "Snacks & Treats", "Toys & Hobbies"],
    })
    y = np.array([1, 1, 0, 1])
    
    pipe.fit(X, y)
    probs = pipe.predict_proba(X)[:, 1]
    
    assert len(probs) == 4
    assert np.all((probs >= 0.0) & (probs <= 1.0))


def test_history_features_no_temporal_leakage():
    """
    Critical ML Test for Model B:
    Future purchases or future labels must NEVER change a child's earlier history features.
    """
    from app.services.impulse_service import add_history_features_dataframe, NUMERIC_FEATURES_HISTORY
    
    t0 = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(hours=5)       # Purchase 1 (5h later)
    t2 = t0 + timedelta(hours=10)      # Purchase 2 (10h later)
    t3_future = t0 + timedelta(days=2) # Future Purchase 3 (2 days later)
    
    base_rows = [
        {
            "child_id": "kid_1",
            "timestamp": t0,
            "amount": 10.0,
            "merchant_category": "Gaming & In-App",
            "is_impulsive": True,
        },
        {
            "child_id": "kid_1",
            "timestamp": t1,
            "amount": 5.0,
            "merchant_category": "Snacks & Treats",
            "is_impulsive": False,
        },
        {
            "child_id": "kid_1",
            "timestamp": t2,
            "amount": 20.0,
            "merchant_category": "Gaming & In-App",
            "is_impulsive": True,
        }
    ]
    
    df_no_future = pd.DataFrame(base_rows)
    
    # Dataset WITH future transaction added with arbitrary values
    future_row = {
        "child_id": "kid_1",
        "timestamp": t3_future,
        "amount": 100.0,
        "merchant_category": "Gaming & In-App",
        "is_impulsive": True,
    }
    df_with_future = pd.concat([df_no_future, pd.DataFrame([future_row])], ignore_index=True)
    
    hist_no_future = add_history_features_dataframe(df_no_future, global_rate=0.6)
    hist_with_future = add_history_features_dataframe(df_with_future, global_rate=0.6)
    
    # Verify first purchase (t0) is pure cold-start
    first_row = hist_no_future.iloc[0]
    assert first_row["n_prior_purchases"] == 0
    assert first_row["spend_24h"] == 0.0
    assert first_row["child_rate"] == 0.6
    
    # Verify second purchase (t1) sees exactly 1 prior purchase
    second_row = hist_no_future.iloc[1]
    assert second_row["n_prior_purchases"] == 1
    assert second_row["spend_24h"] == 10.0
    assert second_row["hours_since_last_purchase"] == 5.0
    
    # Compare all history features for t0, t1, t2 between both datasets
    for col in NUMERIC_FEATURES_HISTORY:
        val1 = hist_no_future[col].to_numpy()
        val2 = hist_with_future.iloc[:3][col].to_numpy()
        np.testing.assert_allclose(
            val1, val2, rtol=1e-5,
            err_msg=f"Temporal leakage in history feature '{col}' when future row was present!"
        )


def test_personalized_pipeline_train_predict():
    """Verify build_personalized_pipeline trains with both static & history features."""
    from app.services.impulse_service import build_personalized_pipeline, ALL_FEATURES_MODEL_B
    
    pipe = build_personalized_pipeline(C=1.0)
    data = {
        "amount": [5.0, 10.0],
        "goal_progress": [0.2, 0.8],
        "amt_to_savings": [0.25, 0.1],
        "amt_to_remaining_goal": [0.06, 0.5],
        "days_since_last_deposit": [1.0, 14.0],
        "hour_of_day": [15, 20],
        "day_of_week": [1, 5],
        "is_weekend": [0, 1],
        "merchant_category": ["Snacks & Treats", "Gaming & In-App"],
        "spend_24h": [0.0, 15.0],
        "spend_7d": [0.0, 30.0],
        "purch_last_hour": [0, 1],
        "hours_since_last_purchase": [168.0, 0.5],
        "n_prior_purchases": [0, 3],
        "child_rate": [0.6, 0.75],
        "child_cat_rate": [0.6, 0.8],
        "logit_child_rate": [0.4, 1.1],
    }
    X = pd.DataFrame(data)[ALL_FEATURES_MODEL_B]
    y = np.array([0, 1])
    
    pipe.fit(X, y)
    probs = pipe.predict_proba(X)[:, 1]
    assert len(probs) == 2
    assert np.all((probs >= 0.0) & (probs <= 1.0))

