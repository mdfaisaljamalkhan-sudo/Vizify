#!/usr/bin/env python
import os
import sys

# Change to backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Load environment variables from .env BEFORE importing app
with open('.env') as f:
    for line in f:
        if line.strip() and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            os.environ[key] = value

# Test imports
try:
    from app.main import app
    from app.database import settings
    print("[OK] All imports successful")
    print(f"[INFO] ANTHROPIC_API_KEY configured: {bool(settings.anthropic_api_key)}")
    print(f"[INFO] Analyzer provider: {settings.analyzer_provider}")
    print(f"[INFO] Working directory: {os.getcwd()}")
except Exception as e:
    print(f"[ERROR] Import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Run uvicorn in the same process
import uvicorn
print("[INFO] Starting uvicorn server on port 8002...")
uvicorn.run(
    app,
    host="127.0.0.1",
    port=8002
)
