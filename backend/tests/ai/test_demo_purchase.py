from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import uuid

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.ai import get_ai_provider
from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models import Base, Child, Family, Transaction, SavingsGoal, ImpulseScore, DecisionEvent, DecisionLog
from app.schemas.demo_purchase import TransactionAssessment
from app.services.ai_context_service import build_context
from app.services.purchase_scoring_adapter import get_purchase_scoring_adapter


@pytest.fixture
def demo_setup(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_PURCHASES_ENABLED", True)
    engine = create_engine(f"sqlite:///{tmp_path / 'demo.db'}", connect_args={"check_same_thread": False, "timeout": 10})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add(Family(id="family", name="Family"))
        db.add_all([Child(id="one", family_id="family", name="One", age=10),
                    Child(id="two", family_id="family", name="Two", age=9)])
        db.add(SavingsGoal(id="goal", child_id="one", name="Lego", current_amount=35, target_amount=80))
        db.commit()
    def sessions():
        with factory() as db:
            yield db
    scoring = SimpleNamespace(read_assessment=Mock(return_value=TransactionAssessment(status="not_connected")))
    ai = Mock(side_effect=AssertionError("Demo endpoints must never request an AI provider"))
    app.dependency_overrides[get_db] = sessions
    app.dependency_overrides[get_purchase_scoring_adapter] = lambda: scoring
    app.dependency_overrides[get_ai_provider] = ai
    with TestClient(app) as client:
        yield client, factory, scoring, ai
    app.dependency_overrides.clear()
    engine.dispose()


def purchase(**overrides):
    return {"transaction_id": str(uuid.uuid4()), "child_id": "one", "product": "Ice cream",
        "merchant": "Demo Ice Cream Shop", "category": "food", "amount": "10.00", "currency": "USD", **overrides}


def test_creation_updates_spending_only_and_injects_known_currency(demo_setup):
    client, factory, scoring, ai = demo_setup
    body = purchase()
    response = client.post('/api/demo/purchases', json=body)
    assert response.status_code == 201, response.text
    result = response.json()
    assert result['assessment']['status'] == 'not_connected'
    assert result['source'] == 'demo' and result['amount'] == '10.00'
    assert datetime.fromisoformat(result['timestamp']).tzinfo is not None
    with factory() as db:
        row = db.query(Transaction).one()
        assert row.child_id == 'one' and row.source == 'demo' and row.currency == 'USD'
        assert not row.is_deposit and not row.is_impulsive and row.nessie_purchase_id is None
        assert db.get(SavingsGoal, 'goal').current_amount == Decimal('35')
        assert db.get(Child, 'one').core_memory['revision'] == 0
        assert db.query(ImpulseScore).count() == db.query(DecisionLog).count() == db.query(DecisionEvent).count() == 0
        context = build_context(db, 'one')
        assert context['recent_purchases'][row.id]['currency'] == 'USD'
    spending = client.get('/api/child/one/spending').json()
    assert spending['categories']['food']['sum'] == 10
    assert spending['weekly_trend'][-1]['total'] == 10
    assert client.get('/api/child/two/spending').json()['categories'] == {}
    assert scoring.read_assessment.call_args.args[1] == body['transaction_id']
    ai.assert_not_called()


def test_retry_and_conflicting_ids_do_not_duplicate_or_change_child(demo_setup):
    client, factory, _, _ = demo_setup
    body = purchase()
    first = client.post('/api/demo/purchases', json=body)
    retried = client.post('/api/demo/purchases', json=body)
    assert retried.status_code == 200
    assert retried.json()['timestamp'] == first.json()['timestamp']
    for changes in ({'amount': '11.00'}, {'child_id': 'two'}, {'product': 'Game'}):
        assert client.post('/api/demo/purchases', json=body | changes).status_code == 409
    with factory() as db:
        assert db.query(Transaction).count() == 1
        assert db.query(Transaction).one().child_id == 'one'


def test_simultaneous_duplicate_submissions(demo_setup):
    client, factory, _, _ = demo_setup
    body = purchase()
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: client.post('/api/demo/purchases', json=body), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 201]
    with factory() as db: assert db.query(Transaction).count() == 1


@pytest.mark.parametrize('changes', [
    {'amount': '0'}, {'amount': '-1'}, {'amount': '1.001'}, {'amount': '100000000.00'}, {'amount': 'NaN'},
    {'currency': 'EUR'}, {'product': ''}, {'merchant': ' '}, {'category': 'x' * 51},
    {'timestamp': '2026-01-01T00:00:00Z'}, {'is_impulsive': True}, {'score': 99}, {'transaction_id': 'bad'},
])
def test_invalid_fields_and_server_owned_fields_rejected(demo_setup, changes):
    client, factory, _, ai = demo_setup
    assert client.post('/api/demo/purchases', json=purchase(**changes)).status_code == 422
    with factory() as db: assert db.query(Transaction).count() == 0
    ai.assert_not_called()


def test_unknown_child_disabled_routes_and_non_demo_lookup(demo_setup, monkeypatch):
    client, factory, _, _ = demo_setup
    body = purchase(child_id='missing')
    assert client.post('/api/demo/purchases', json=body).status_code == 404
    with factory() as db:
        db.add(Transaction(id=body['transaction_id'], child_id='one', merchant_name='Bank', merchant_category='food',
            amount=1, timestamp=datetime.now(timezone.utc)))
        db.commit()
    assert client.get(f"/api/demo/purchases/{body['transaction_id']}").status_code == 404
    assert client.post('/api/demo/purchases', json=body | {'child_id': 'one'}).status_code == 409
    monkeypatch.setattr(settings, 'DEMO_PURCHASES_ENABLED', False)
    assert client.post('/api/demo/purchases', json=purchase()).status_code == 404
    assert client.get(f"/api/demo/purchases/{body['transaction_id']}").status_code == 404


@pytest.mark.parametrize('assessment', [
    {'status': 'pending'}, {'status': 'processing'}, {'status': 'not_connected'},
    {'status': 'failed', 'error': 'private upstream error'},
    {'status': 'completed', 'outcome': 'insufficient_data', 'explanation': 'Not enough information'},
    {'status': 'completed', 'outcome': 'assessed', 'assessment_id': 'assessment', 'score': 55,
     'explanation': 'Contextual assessment', 'factors': [{'factor': 'amount', 'description': 'Recorded price',
        'contribution': .5, 'evidence_refs': ['transaction']}]},
])
def test_transaction_linked_scoring_status_without_generation(demo_setup, assessment):
    client, _, scoring, ai = demo_setup
    body = purchase()
    client.post('/api/demo/purchases', json=body)
    scoring.read_assessment.return_value = TransactionAssessment(**assessment)
    response = client.get(f"/api/demo/purchases/{body['transaction_id']}")
    assert response.status_code == 200
    assert response.json()['assessment']['status'] == assessment['status']
    assert 'private' not in response.text
    assert scoring.read_assessment.call_args.args[1] == body['transaction_id']
    ai.assert_not_called()


def test_scoring_read_failure_never_rolls_back_saved_purchase(demo_setup):
    client, factory, scoring, ai = demo_setup
    scoring.read_assessment.side_effect = RuntimeError('private payload')
    body = purchase()
    response = client.post('/api/demo/purchases', json=body)
    assert response.status_code == 201
    assert response.json()['assessment']['status'] == 'failed' and 'private' not in response.text
    with factory() as db: assert db.query(Transaction).count() == 1
    ai.assert_not_called()


def test_migration_retains_legacy_and_demo_rows_on_downgrade():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).resolve().parents[2] / 'alembic/versions/e82d4bc91320_demo_purchases.py'
    spec = importlib.util.spec_from_file_location('demo_migration', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE transactions (id VARCHAR PRIMARY KEY)'))
        connection.execute(text("INSERT INTO transactions VALUES ('legacy')"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            assert connection.execute(text('SELECT source, currency FROM transactions')).one() == ('legacy', None)
            connection.execute(text("INSERT INTO transactions (id,source,currency) VALUES ('demo','demo','USD')"))
            module.downgrade()
            assert len(connection.execute(text('SELECT id FROM transactions')).all()) == 2
            assert {c['name'] for c in inspect(connection).get_columns('transactions')} == {'id'}
    engine.dispose()
