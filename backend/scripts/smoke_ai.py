"""Opt-in provider check: from backend run `python -m scripts.smoke_ai --live`.

Uses fictional context, no database writes, and prints no credentials or message content.
"""
import argparse
import asyncio

from app.core.ai import provider
from app.services.coaching_service import generate


async def main():
    snapshot = {"profile": {"name": "Test child", "age": 10},
                "coverage": {"timezone": "UTC", "currency": "unknown", "days": 30},
                "spending": {"count": 1, "total": "5.00"},
                "goals": {"test-goal": {"name": "Bicycle", "target": "100.00", "saved": "20.00", "remaining": "80.00"}},
                "recent_purchases": {"test-purchase": {"amount": "5.00", "merchant": "Book shop", "category": "Books", "timestamp": "2026-10-24T12:00:00+00:00"}}}
    try:
        # One user action: one generation request, at most one transient-error retry.
        result = await generate("chat", snapshot, provider, {"message": "How can I start saving?"})
        assert result.message
        print("PASS: Gemini returned a valid zero-shot coaching response.")
    finally:
        await provider.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Send a small paid Gemini request")
    if not parser.parse_args().live:
        parser.error("Pass --live to explicitly enable a provider request")
    asyncio.run(main())
