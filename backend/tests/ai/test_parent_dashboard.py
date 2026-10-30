from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models import Base, Child, DecisionLog, Family, Memory, Transaction


@pytest.fixture
def dashboard():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        db.add(Family(id="family", name="Family"))
        db.add_all([Child(id=key, family_id="family", name=key, age=10) for key in ["a", "b", "empty"]])
        db.commit()
        app.dependency_overrides[get_db] = lambda: db
        try:
            with TestClient(app) as client:
                yield client, db
        finally:
            app.dependency_overrides.clear()
    engine.dispose()


def test_saved_memories_are_scoped_sorted_and_read_only(dashboard):
    client, db = dashboard
    now = datetime.now(timezone.utc)
    db.add_all([
        Memory(id="old", child_id="a", memory_type="preference", content="Books", created_at=now - timedelta(days=1)),
        Memory(id="new", child_id="a", memory_type="context", content="Saving for a bike", created_at=now,
               category="Travel", confidence=0.8, suppress_alerts=True, suppress_until=now),
        Memory(id="other", child_id="b", memory_type="context", content="Other child", created_at=now),
    ])
    db.commit()
    response = client.get("/api/child/a/memories")
    assert response.status_code == 200
    memories = response.json()["memories"]
    assert [m["id"] for m in memories] == ["new", "old"]
    assert memories[0]["content"] == "Saving for a bike"
    assert memories[0]["child_id"] == "a"
    assert memories[0]["created_at"]
    assert memories[0]["suppress_until"]
    assert memories[0]["confidence"] == 0.8
    assert db.query(Memory).count() == 3
    assert client.get("/api/child/empty/memories").json() == {"memories": []}
    assert client.get("/api/child/missing/memories").status_code == 404


def test_purchase_history_filters_serializes_and_paginates(dashboard):
    client, db = dashboard
    now = datetime.now(timezone.utc)
    for key, child, deposit, timestamp in [
        ("a", "a", False, now), ("b", "a", False, now),
        ("old", "a", False, now - timedelta(days=1)),
        ("deposit", "a", True, now), ("other", "b", False, now),
    ]:
        db.add(Transaction(id=key, child_id=child, amount=Decimal("12.34"), merchant_name="Book shop",
                           merchant_category="Books", description="A book", timestamp=timestamp, is_deposit=deposit))
    db.commit()
    first = client.get("/api/child/a/transactions?limit=1").json()
    assert first["has_more"] is True
    assert first["transactions"][0] == {
        "id": "a", "child_id": "a", "amount": 12.34, "merchant_name": "Book shop",
        "merchant_category": "Books", "description": "A book", "timestamp": now.replace(tzinfo=None).isoformat(),
    }
    second = client.get("/api/child/a/transactions?limit=1&offset=1").json()
    assert [t["id"] for t in second["transactions"]] == ["b"]
    assert second["has_more"] is True
    last = client.get("/api/child/a/transactions?limit=1&offset=2").json()
    assert [t["id"] for t in last["transactions"]] == ["old"]
    assert last["has_more"] is False
    default = client.get("/api/child/a/transactions").json()
    assert [t["id"] for t in default["transactions"]] == ["a", "b", "old"]
    assert default["has_more"] is False
    assert client.get("/api/child/a/transactions?offset=100").json() == {"transactions": [], "has_more": False}
    assert client.get("/api/child/empty/transactions").json() == {"transactions": [], "has_more": False}
    assert client.get("/api/child/missing/transactions").status_code == 404


@pytest.mark.parametrize("query", ["limit=0", "limit=-1", "limit=101", "offset=-1", "limit=abc", "offset=abc"])
def test_transaction_pagination_validation(dashboard, query):
    client, _ = dashboard
    assert client.get(f"/api/child/a/transactions?{query}").status_code == 422


def test_family_activity_includes_recorded_timestamp(dashboard):
    client, db = dashboard
    timestamp = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
    db.add(DecisionLog(id="decision", child_id="a", trigger="Books", decision="ALLOW", timestamp=timestamp))
    db.commit()
    response = client.get("/api/family/family/overview")
    assert response.status_code == 200
    child = next(child for child in response.json()["children"] if child["id"] == "a")
    assert child["recent_decisions"][0]["timestamp"] == timestamp.replace(tzinfo=None).isoformat()


def test_family_purchases_scope_order_and_pagination(dashboard):
    client, db = dashboard
    now = datetime.now(timezone.utc)
    db.add(Family(id="other-family", name="Other family"))
    db.add(Child(id="outsider", family_id="other-family", name="Other child", age=9))
    db.add_all([
        Transaction(id=key, child_id=child, is_deposit=deposit,
                    amount=Decimal("12.34"), merchant_name="Shop", merchant_category="Books",
                    description=description, timestamp=timestamp)
        for key, child, deposit, timestamp, description in [
            ("a", "a", False, now, "A book"),
            ("b", "b", False, now, None),
            ("old", "a", False, now - timedelta(days=1), None),
            ("deposit", "a", True, now, None),
            ("outside", "outsider", False, now, None),
            ("future", "a", False, now + timedelta(days=30), "Future seed purchase"),
        ]
    ])
    db.commit()
    response = client.get("/api/family/family/purchases")
    assert response.status_code == 200
    body = response.json()
    assert all(p.pop("assessment")["status"] == "not_connected" for p in body["purchases"])
    assert body == {"purchases": [
        {"id": key, "child_id": child, "child_name": child, "amount": 12.34,
         "merchant_name": "Shop", "merchant_category": "Books", "description": description,
         "timestamp": timestamp.replace(tzinfo=None).isoformat()}
        for key, child, timestamp, description in [
            ("a", "a", now, "A book"), ("b", "b", now, None),
            ("old", "a", now - timedelta(days=1), None),
        ]
    ], "has_more": False}
    first = client.get("/api/family/family/purchases?limit=1").json()
    assert [p["id"] for p in first["purchases"]] == ["a"]
    assert first["has_more"] is True
    last = client.get("/api/family/family/purchases?limit=2&offset=1").json()
    assert [p["id"] for p in last["purchases"]] == ["b", "old"]
    assert last["has_more"] is False
    assert client.get("/api/family/family/purchases?offset=100").json() == {"purchases": [], "has_more": False}

    db.add(Transaction(id="new", child_id="b", is_deposit=False, amount=Decimal("5"),
                       merchant_name="New shop", merchant_category="Food", timestamp=datetime.now(timezone.utc)))
    db.commit()
    refreshed = client.get("/api/family/family/purchases").json()["purchases"]
    assert [p["id"] for p in refreshed] == ["new", "a", "b", "old"]


def test_family_purchases_empty_and_missing(dashboard):
    client, db = dashboard
    assert client.get("/api/family/family/purchases").json() == {"purchases": [], "has_more": False}
    db.add(Family(id="no-kids", name="No kids"))
    db.commit()
    assert client.get("/api/family/no-kids/purchases").json() == {"purchases": [], "has_more": False}
    assert client.get("/api/family/missing/purchases").status_code == 404


@pytest.mark.parametrize("query", ["limit=0", "limit=-1", "limit=101", "offset=-1", "limit=abc", "offset=abc"])
def test_family_purchases_pagination_validation(dashboard, query):
    client, _ = dashboard
    assert client.get(f"/api/family/family/purchases?{query}").status_code == 422
