# Standalone Synthetic Dataset Generation Task

> **Context for Agent / GPU Server**: 
> You are generating a synthetic dataset of adolescent financial transactions. 
> Output the result to a single local file named: `transactions.jsonl` (one JSON object per line).
> No external project dependencies are required.

---

## 1. Goal
Generate **1,500 to 2,000 realistic, chronological financial transactions** across **5 distinct adolescent personas** over a **60-day simulated timeline**.

---

## 2. Personas to Generate (~300–400 transactions each)

1. **Marcus (Age 14, Impulsive Gamer)**:
   * **Profile**: Heavy gaming on Steam, Roblox, Discord. 
   * **Pattern**: Late-night purchases (9 PM – 1 AM), weekend burst clusters.
   * **Active Goal**: "Gaming PC Build" (Target: $600).
   * **Impulsivity**: **~70% of purchases are impulsive (`is_impulsive: true`)**.

2. **Emma (Age 10, Learning Improver)**:
   * **Profile**: Art supplies, school books, snacks, occasional Roblox.
   * **Pattern**: Mostly daytime/after-school; occasional weekend impulse buy.
   * **Active Goal**: "Skateboard" (Target: $120).
   * **Impulsivity**: **~35% of purchases are impulsive (`is_impulsive: true`)**.

3. **Sofia (Age 13, Disciplined Saver)**:
   * **Profile**: Careful planner, books, school supplies, cafeteria lunch.
   * **Pattern**: Daytime, planned, consistent weekly savings.
   * **Active Goal**: "School Laptop" (Target: $450).
   * **Impulsivity**: **~10% of purchases are impulsive (`is_impulsive: true`)**.

4. **Lucas (Age 7, Young Checkout Buyer)**:
   * **Profile**: Tempted by candy, convenience store snacks, small toy packs.
   * **Pattern**: Small frequent amounts ($2–$10), erratic timing.
   * **Active Goal**: "Lego Space Shuttle" (Target: $80).
   * **Impulsivity**: **~55% of purchases are impulsive (`is_impulsive: true`)**.

5. **Jamal (Age 12, Sports Enthusiast)**:
   * **Profile**: Sports gear, basketball accessories, sports drinks.
   * **Pattern**: Weekend sporting events, occasional impulsive sneaker/gear drops.
   * **Active Goal**: "Basketball Shoes" (Target: $140).
   * **Impulsivity**: **~40% of purchases are impulsive (`is_impulsive: true`)**.

---

## 3. Required JSON Line Schema

Each line in `transactions.jsonl` must be a valid JSON object matching this schema:

```json
{
  "child_id": "marcus",
  "persona_name": "Marcus",
  "timestamp": "2026-10-18T22:45:00Z",
  "merchant_name": "Steam",
  "merchant_category": "Gaming & In-App",
  "product_name": "Game Cosmetic Pass",
  "amount": 9.99,
  "is_deposit": false,
  "active_goal_name": "Gaming PC Build",
  "goal_target_amount": 600.0,
  "current_savings_at_time": 210.0,
  "is_impulsive": true,
  "psychological_context": "Late night purchase after seeing friend's game skin on Discord."
}
```

### Constraints:
* Include periodic allowance deposits (`is_deposit: true`, e.g. $10–$20 once a week) for realistic balance flows.
* `merchant_category` should use realistic categories: `Gaming & In-App`, `Snacks & Treats`, `Books & Learning`, `Toys & Hobbies`, `Sports & Outdoors`, `Apparel`.
* Ensure `timestamp` values span chronologically across a 60-day window.

---

## 4. Standalone Generator Script (Run on GPU Server)

Save and run this script directly on the GPU machine:

```python
import json
import os
from openai import OpenAI

# Connect to local model (vLLM / Ollama / TGI endpoint on this server)
client = OpenAI(
    base_url=os.environ.get("OPENAI_BASE_URL", "http://localhost:8000/v1"),
    api_key=os.environ.get("OPENAI_API_KEY", "EMPTY"),
)
MODEL = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-32B-Instruct")

PERSONAS = [
    {
        "id": "marcus", "name": "Marcus", "age": 14,
        "goal": "Gaming PC Build", "target": 600.0,
        "desc": "Impulsive late-night gamer on Steam/Roblox, ~70% impulsive."
    },
    {
        "id": "emma", "name": "Emma", "age": 10,
        "goal": "Skateboard", "target": 120.0,
        "desc": "Learning saver, art and snacks, ~35% impulsive."
    },
    {
        "id": "sofia", "name": "Sofia", "age": 13,
        "goal": "School Laptop", "target": 450.0,
        "desc": "Disciplined saver, books and school supplies, ~10% impulsive."
    },
    {
        "id": "lucas", "name": "Lucas", "age": 7,
        "goal": "Lego Space Shuttle", "target": 80.0,
        "desc": "Young child, candy and checkout-aisle toys ($2-$10), ~55% impulsive."
    },
    {
        "id": "jamal", "name": "Jamal", "age": 12,
        "goal": "Basketball Shoes", "target": 140.0,
        "desc": "Sports lover, drinks and gear drops, ~40% impulsive."
    }
]

SYSTEM_PROMPT = """You are a behavioral finance data synthesizer.
Generate authentic, chronological adolescent transactions over a 60-day period.
Output ONLY a valid JSON array of transaction objects. No markdown formatting, no conversational text."""

def generate_batch(persona, batch_num, count=35):
    prompt = f"""Generate a batch of {count} chronological transactions for:
Persona: {persona['name']} (Age {persona['age']}) | Goal: {persona['goal']} (${persona['target']})
Traits: {persona['desc']}
Batch {batch_num} of 10.

Include weekly allowance deposits, daytime purchases, and evening purchase attempts.
Output JSON schema:
[
  {{
    "child_id": "{persona['id']}",
    "persona_name": "{persona['name']}",
    "timestamp": "2026-09-01T14:30:00Z",
    "merchant_name": "Merchant Name",
    "merchant_category": "Gaming & In-App | Snacks & Treats | Books & Learning | Toys & Hobbies | Sports & Outdoors",
    "product_name": "Product Name",
    "amount": 9.99,
    "is_deposit": false,
    "active_goal_name": "{persona['goal']}",
    "goal_target_amount": {persona['target']},
    "current_savings_at_time": 50.0,
    "is_impulsive": true,
    "psychological_context": "Reasoning"
  }}
]"""
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
    )
    return resp.choices[0].message.content

def main():
    out_file = "transactions.jsonl"
    total = 0
    print(f"Generating transactions to {out_file}...")

    with open(out_file, "w", encoding="utf-8") as f:
        for p in PERSONAS:
            print(f"--> Persona: {p['name']}")
            for b in range(1, 11):
                try:
                    content = generate_batch(p, b, count=35)
                    data = json.loads(content)
                    items = data if isinstance(data, list) else data.get("transactions", data.get("items", []))
                    for item in items:
                        f.write(json.dumps(item) + "\n")
                        total += 1
                    print(f"    Batch {b}/10 done ({len(items)} items, Total: {total})")
                except Exception as e:
                    print(f"    Batch {b} parse error: {e}")

    print(f"\nDone! Saved {total} transactions to {out_file}")

if __name__ == "__main__":
    main()
```
