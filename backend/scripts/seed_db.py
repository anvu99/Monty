import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Child,
    DecisionLog,
    Family,
    ImpulseScore,
    Memory,
    SavingsGoal,
    Transaction,
    User,
)


def seed_database():
    print("=" * 60)
    print("SEEDING NEON POSTGRESQL WITH RICH PRODUCTION DATA")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Clean up any existing demo families to ensure idempotency
        existing_family = db.query(Family).filter_by(id="family-001").first()
        if existing_family:
            print("Cleaning up old demo family...")
            db.delete(existing_family)
            db.commit()

        # -----------------------------------------------------------------
        # 1. Create Family & Parent
        # -----------------------------------------------------------------
        print("\n1. Creating Family & Parent User...")
        family = Family(
            id="family-001",
            name="The Johnsons",
        )
        db.add(family)
        db.flush()

        parent = User(
            id="user-001",
            family_id=family.id,
            email="sarah.johnson@example.com",
            hashed_password=hash_password("MontyPass2026!"),
            full_name="Sarah Johnson",
            role="parent",
        )
        db.add(parent)

        # -----------------------------------------------------------------
        # 2. Create Children with distinct behavioral personas
        # -----------------------------------------------------------------
        print("2. Creating Children (Emma, Lucas, Marcus)...")
        emma = Child(
            id="kid-1",
            family_id=family.id,
            name="Emma",
            age=10,
            avatar="fox",
            nessie_customer_id="nessie-cust-emma",
        )
        lucas = Child(
            id="kid-2",
            family_id=family.id,
            name="Lucas",
            age=7,
            avatar="rabbit",
            nessie_customer_id="nessie-cust-lucas",
        )
        marcus = Child(
            id="kid-3",
            family_id=family.id,
            name="Marcus",
            age=14,
            avatar="bear",
            nessie_customer_id="nessie-cust-marcus",
        )
        db.add_all([emma, lucas, marcus])
        db.flush()

        # -----------------------------------------------------------------
        # 3. Create Savings Goals
        # -----------------------------------------------------------------
        print("3. Creating Savings Goals...")
        goals = [
            SavingsGoal(
                id="goal-1",
                child_id=emma.id,
                nessie_account_id="nessie-acc-emma-skate",
                name="Skateboard",
                target_amount=120.00,
                current_amount=68.00,
                weekly_contribution=10.00,
                status="active",
            ),
            SavingsGoal(
                id="goal-2",
                child_id=emma.id,
                nessie_account_id="nessie-acc-emma-camp",
                name="Science Camp",
                target_amount=200.00,
                current_amount=140.00,
                weekly_contribution=15.00,
                status="active",
            ),
            SavingsGoal(
                id="goal-3",
                child_id=lucas.id,
                nessie_account_id="nessie-acc-lucas-lego",
                name="Lego Space Shuttle",
                target_amount=80.00,
                current_amount=35.00,
                weekly_contribution=8.00,
                status="active",
            ),
            SavingsGoal(
                id="goal-4",
                child_id=marcus.id,
                nessie_account_id="nessie-acc-marcus-pc",
                name="Gaming PC Build",
                target_amount=600.00,
                current_amount=210.00,
                weekly_contribution=25.00,
                status="active",
            ),
        ]
        db.add_all(goals)

        # -----------------------------------------------------------------
        # 4. Create 30 Days of Sequenced Transactions (For LSTM & Analytics)
        # -----------------------------------------------------------------
        print("4. Generating 30 Days of Time-Series Transactions...")
        now = datetime.now(timezone.utc)
        transactions = []

        merchants_by_cat = {
            "Gaming & In-App": [("Roblox", 4.99), ("Steam", 14.99), ("Epic Games", 9.99), ("Nintendo eShop", 7.99)],
            "Snacks & Treats": [("Sweet Shop", 4.25), ("7-Eleven", 3.50), ("Starbucks", 5.75), ("Jamba Juice", 6.50)],
            "Books & Learning": [("Barnes & Noble", 12.99), ("Scholastic", 8.50), ("Local Bookshop", 15.00)],
            "Toys & Hobbies": [("Target", 18.50), ("Lego Store", 24.99), ("Michaels Crafts", 11.20)],
        }

        # Seed realistic transactions over the last 30 days
        for day_offset in range(30, 0, -1):
            tx_date = now - timedelta(days=day_offset)

            # Weekly Allowance Deposit for Emma
            if day_offset % 7 == 0:
                transactions.append(
                    Transaction(
                        child_id=emma.id,
                        amount=15.00,
                        merchant_name="Allowance Deposit",
                        merchant_category="Allowance",
                        description="Weekly allowance from Mom",
                        timestamp=tx_date.replace(hour=9, minute=0),
                        is_deposit=True,
                        is_impulsive=False,
                    )
                )

            # Emma's occasional purchases (becoming more thoughtful over time)
            if day_offset in [28, 25, 21, 18, 14, 10, 7, 3]:
                cat = "Gaming & In-App" if day_offset > 20 else "Books & Learning"
                merch, base_amt = random.choice(merchants_by_cat[cat])
                is_imp = day_offset > 20
                transactions.append(
                    Transaction(
                        child_id=emma.id,
                        amount=base_amt,
                        merchant_name=merch,
                        merchant_category=cat,
                        description=f"Purchase at {merch}",
                        timestamp=tx_date.replace(hour=16, minute=random.randint(10, 50)),
                        is_deposit=False,
                        is_impulsive=is_imp,
                    )
                )

            # Marcus (Late night weekend gaming bursts - high impulse pattern)
            if tx_date.weekday() in [4, 5]:  # Friday / Saturday
                merch, base_amt = random.choice(merchants_by_cat["Gaming & In-App"])
                transactions.append(
                    Transaction(
                        child_id=marcus.id,
                        amount=base_amt,
                        merchant_name=merch,
                        merchant_category="Gaming & In-App",
                        description=f"Late night {merch} purchase",
                        timestamp=tx_date.replace(hour=22, minute=random.randint(15, 55)),
                        is_deposit=False,
                        is_impulsive=True,
                    )
                )

        db.add_all(transactions)

        # -----------------------------------------------------------------
        # 5. Create AI Episodic Memories
        # -----------------------------------------------------------------
        print("5. Creating AI Episodic Memories...")
        memories = [
            Memory(
                child_id=emma.id,
                memory_type="preference",
                content="Loves skateboarding and outdoor activities. Really motivated to buy her own board.",
                category="interests",
                confidence=0.95,
            ),
            Memory(
                child_id=emma.id,
                memory_type="impulse_trigger",
                content="Used to make impulse purchases in Roblox after seeing friend cosmetics, but responded well to 10-minute wait pauses.",
                category="triggers",
                confidence=0.90,
            ),
            Memory(
                child_id=marcus.id,
                memory_type="impulse_trigger",
                content="Strong tendency to purchase digital weapon skins during late-night weekend gaming sessions between 10 PM and 1 AM.",
                category="triggers",
                confidence=0.94,
            ),
        ]
        db.add_all(memories)

        # -----------------------------------------------------------------
        # 6. Create Impulse Risk Scores & Decision Logs
        # -----------------------------------------------------------------
        print("6. Creating Impulse Scores & Decision Flowchart Logs...")
        impulse = ImpulseScore(
            child_id=emma.id,
            product_name="Roblox Diamond Armor Skin",
            amount=4.99,
            merchant_name="Roblox",
            merchant_category="Gaming & In-App",
            impulse_score=74.5,
            factors={
                "time_of_day": {"value": "9:15 PM", "impulse_weight": 0.35},
                "category_risk": {"value": "In-Game Cosmetic", "impulse_weight": 0.40},
                "goal_impact": {"value": "4.1% of Skateboard Budget", "impulse_weight": 0.25},
            },
            alert_triggered=True,
            alert_type="wait_nudge",
            child_response="paused",
            timestamp=now - timedelta(hours=3),
        )
        db.add(impulse)

        decision = DecisionLog(
            child_id=emma.id,
            trigger="Roblox in-app purchase request ($4.99)",
            impulse_score=74.5,
            decision="NUDGE_PAUSE",
            coaching_message="Hey Emma! That skin looks cool, but $4.99 is half of this week's skateboard savings. How about waiting 10 minutes first?",
            ai_justification="High impulse probability detected: digital cosmetic, evening timeframe, active goal in progress.",
            child_response="agreed_to_wait",
            factors={
                "time_of_day": "evening",
                "goal_distance_remaining": 52.00,
            },
            pipeline_nodes=[
                {"id": "node-1", "label": "Purchase Attempt ($4.99)", "type": "trigger", "status": "active"},
                {"id": "node-2", "label": "Impulse Risk Scored: 74.5 (High)", "type": "evaluation", "status": "completed"},
                {"id": "node-3", "label": "Action: Suggest 10-Minute Pause", "type": "intervention", "status": "success"},
            ],
            pipeline_edges=[
                {"id": "e1-2", "source": "node-1", "target": "node-2"},
                {"id": "e2-3", "source": "node-2", "target": "node-3"},
            ],
            timestamp=now - timedelta(hours=3),
        )
        db.add(decision)

        db.commit()
        print("\n" + "=" * 60)
        print("SUCCESS! NEON DATABASE FULLY SEEDED WITH AUTHENTIC DATA:")
        print(f"  - 1 Family ({family.name})")
        print(f"  - 1 Parent ({parent.email})")
        print(f"  - 3 Children (Emma, Lucas, Marcus)")
        print(f"  - {len(goals)} Active Savings Goals")
        print(f"  - {len(transactions)} Sequenced Transactions spanning 30 days")
        print(f"  - {len(memories)} AI Episodic Memories")
        print(f"  - 1 Impulse Risk Evaluation + Decision Flowchart")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\nERROR seeding database: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
