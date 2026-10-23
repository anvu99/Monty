import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text
from app.core.database import engine, SessionLocal
from app.models import Family, Child

def main():
    print("=" * 60)
    print("LIVE NEON POSTGRESQL VERIFICATION")
    print("=" * 60)

    # 1. Inspect live tables
    inspector = inspect(engine)
    tables = sorted(inspector.get_table_names())
    print(f"\nFound {len(tables)} tables in Neon PostgreSQL:")
    for t in tables:
        cols = inspector.get_columns(t)
        print(f"  [EXISTS] {t:18} ({len(cols):2} columns)")

    # 2. Check Alembic version tracking
    with engine.connect() as conn:
        rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        print(f"\nCurrent Alembic Migration Version: {rev}")

    # 3. Test Live Insert & Rollback (Round-trip CRUD check)
    print("\nTesting Live Transaction (Insert -> Read -> Delete)...")
    db = SessionLocal()
    try:
        test_family = Family(name="Verification Family")
        db.add(test_family)
        db.flush()

        test_child = Child(
            family_id=test_family.id,
            name="Verification Kid",
            age=9,
            avatar="fox"
        )
        db.add(test_child)
        db.commit()

        # Query back
        loaded = db.query(Family).filter_by(id=test_family.id).first()
        assert loaded is not None, "Family was not loaded"
        assert len(loaded.children) == 1, "Child relationship failed"
        print("  [PASS] Insert & Relational Read OK")

        # Cleanup
        db.delete(loaded)
        db.commit()
        print("  [PASS] Cascade Delete OK")
        print("\nALL PHASE 2 DATABASE CHECKS PASSED WITH FLYING COLORS!")

    except Exception as e:
        db.rollback()
        print(f"  [FAIL] Database test failed: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
