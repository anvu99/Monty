import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

def main():
    client = TestClient(app)

    print("=" * 65)
    print("TESTING LIVE WIRED ENDPOINTS (FastAPI -> Services -> Neon DB)")
    print("=" * 65)

    # 1. Test /api/families
    r = client.get("/api/families")
    assert r.status_code == 200, f"GET /families failed: {r.text}"
    data = r.json()
    print(f"PASS | GET /api/families -> {r.status_code} | Found {len(data['families'])} families from Neon DB")
    for f in data["families"]:
        print(f"       Family: {f['id']} with kids: {[k['name'] for k in f['children']]}")

    # 2. Test /api/family/family-001/overview
    r = client.get("/api/family/family-001/overview")
    assert r.status_code == 200, f"GET /family/overview failed: {r.text}"
    overview = r.json()
    print(f"PASS | GET /api/family/family-001/overview -> {r.status_code} | Preloaded {len(overview['children'])} kids")
    for kid in overview["children"]:
        goals_desc = [f"{g['name']} ({g['pct_complete']}%, {g['weeks_remaining']} wks)" for g in kid["goals"]]
        print(f"       - {kid['name']:6} (Habit: {kid['habit_score']['score']} pts) | Goals: {goals_desc}")

    # 3. Test /api/child/kid-1/goals
    r = client.get("/api/child/kid-1/goals")
    assert r.status_code == 200
    goals = r.json()["goals"]
    print(f"PASS | GET /api/child/kid-1/goals -> {r.status_code} | Emma has {len(goals)} active goals in cloud DB")

    # 4. Test /api/child/kid-1/spending
    r = client.get("/api/child/kid-1/spending")
    assert r.status_code == 200
    spending = r.json()
    print(f"PASS | GET /api/child/kid-1/spending -> {r.status_code} | Live categories: {list(spending['categories'].keys())}")

    # 5. Test Live Mutation (Add money via HTTP)
    r = client.post("/api/child/kid-1/goals/goal-1/add-money", json={"amount": 10.0})
    assert r.status_code == 200
    updated_goal = r.json()
    print(f"PASS | POST /api/child/kid-1/goals/goal-1/add-money -> {r.status_code} | New balance: ${updated_goal['current_amount']}")

    print("\nALL WIRED ENDPOINTS ARE LIVE AND COMMUNICATING WITH NEON POSTGRESQL!")

if __name__ == "__main__":
    main()
