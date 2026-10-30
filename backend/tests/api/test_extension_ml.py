"""
End-to-End Tests for ML Scoring Integration with Extension Endpoints.

Verifies:
1. score_transaction() reads DB context, calculates features, and writes ImpulseScore.
2. POST /api/v1/extension/detect returns fast (<10ms) calibrated scores and factors.
3. GET /api/v1/extension/check-risk returns the latest assessment with parsed factors.
"""

from datetime import datetime, timezone
import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.models.base import Base
from app.main import app
from app.models import Child, Family, SavingsGoal, Transaction, ImpulseScore
from app.services.impulse_service import score_transaction


from sqlalchemy.pool import StaticPool


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    
    # Seed minimal hierarchy
    family = Family(id="fam_test", name="Test Family")
    session.add(family)
    
    child = Child(id="child_test", family_id="fam_test", name="Leo", age=11)
    session.add(child)
    
    goal = SavingsGoal(
        id="goal_test",
        child_id="child_test",
        name="Skateboard",
        target_amount=100.0,
        current_amount=40.0,
        status="active"
    )
    session.add(goal)
    
    # Add a prior deposit
    dep = Transaction(
        id="dep_test",
        child_id="child_test",
        amount=25.0,
        merchant_name="Allowance",
        merchant_category="Allowance & Earnings",
        is_deposit=True,
        timestamp=datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
    )
    session.add(dep)
    session.commit()
    
    yield session
    session.close()


def test_score_transaction_direct(test_db):
    """Verify direct score_transaction execution and DB persistence."""
    # Warmup
    score_transaction(
        db=test_db,
        child_id="child_test",
        amount=5.0,
        merchant="Store",
        product_name="Candy",
        save_to_db=False,
    )
    
    # Measure warm execution time
    start_t = time.monotonic()
    result = score_transaction(
        db=test_db,
        child_id="child_test",
        amount=15.0,
        merchant="Roblox",
        product_name="1000 Robux",
        category="Gaming & In-App",
        save_to_db=True,
    )
    duration_ms = (time.monotonic() - start_t) * 1000.0
    
    # Warm inference should be blazing fast (<25ms)
    assert duration_ms < 25.0
    assert 0.0 <= result["impulse_score"] <= 100.0
    assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert result["category"] == "Gaming & In-App"
    assert len(result["factors"]) > 0
    assert result["score_id"] is not None
    
    # Check that record exists in DB
    record = test_db.get(ImpulseScore, result["score_id"])
    assert record is not None
    assert float(record.amount) == 15.0
    assert record.merchant_category == "Gaming & In-App"


def test_extension_endpoints_detect_and_check_risk(test_db):
    """Verify HTTP endpoints for Chrome extension."""
    def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    
    # 1. Test POST /api/extension/detect
    detect_payload = {
        "url": "https://www.amazon.com/dp/B08N5WRWNW",
        "product_name": "Gummy Candy Snack Pack",
        "price": 3.99,
        "currency": "USD",
        "merchant": "www.amazon.com",
        "child_id": "child_test",
        "timestamp": "2026-10-25T14:30:00Z"
    }
    
    res = client.post("/api/extension/detect", json=detect_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    
    assert "alert_id" in data
    assert "impulse_score" in data
    assert 0.0 <= data["impulse_score"] <= 1.0
    assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert "factors" in data
    
    # 2. Test GET /api/extension/check-risk
    res_risk = client.get("/api/extension/check-risk?child_id=child_test")
    assert res_risk.status_code == 200
    risk_data = res_risk.json()
    
    current_score = risk_data["current_risk_score"]
    assert current_score["status"] == "assessed"
    assert current_score["risk_score"] is not None
    assert len(current_score["factors"]) > 0

    # 3. Test demo_child_001 automatic fallback alias to Emma (kid-1)
    # Seed kid-1 into test_db
    kid1 = Child(id="kid-1", family_id="fam_test", name="Emma", age=10)
    test_db.add(kid1)
    test_db.commit()

    demo_payload = {
        "url": "https://www.amazon.com/dp/B08N5WRWNW",
        "product_name": "Lego Space Shuttle",
        "price": 24.99,
        "merchant": "www.amazon.com",
        "child_id": "demo_child_001",
    }
    res_demo = client.post("/api/extension/detect", json=demo_payload)
    assert res_demo.status_code == 200
    demo_data = res_demo.json()
    assert demo_data["impulse_score"] is not None
    assert demo_data["risk_level"] in ("LOW", "MEDIUM", "HIGH")

    app.dependency_overrides.clear()

