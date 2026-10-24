import os
import sys
from pathlib import Path

# Tests never connect to the developer's database or send real model requests.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-only-secret"
os.environ["GEMINI_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
