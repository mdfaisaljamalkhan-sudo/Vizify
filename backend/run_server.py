#!/usr/bin/env python
import os
import sys

# Change to backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Load .env if present (local dev). In Docker/Render, env vars come from the platform.
env_path = os.path.join(backend_dir, '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ.setdefault(key, value)

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

import uvicorn
port = int(os.environ.get("PORT", 8002))
host = os.environ.get("HOST", "127.0.0.1" if settings.environment == "development" else "0.0.0.0")
print(f"[INFO] Starting uvicorn server on {host}:{port}...")
uvicorn.run(app, host=host, port=port)
