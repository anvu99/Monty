import os
import sys
from pathlib import Path

# Tests never connect to the developer's database or send real model requests.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-only-secret"
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["AI_EXTRACTION_WORKER_ENABLED"] = "false"
os.environ["AI_SEMANTIC_CONSOLIDATION_ENABLED"] = "false"
os.environ["DEMO_PURCHASES_ENABLED"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
