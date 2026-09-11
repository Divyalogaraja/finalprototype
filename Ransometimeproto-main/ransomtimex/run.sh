#!/usr/bin/env bash
# RansomTime-X launcher — single-server mode (serves built frontend + API on :8000)
set -e
cd "$(dirname "$0")"

# Build frontend if no production bundle exists yet
if [ ! -f frontend/dist/index.html ]; then
  echo ">> Building frontend (first run)..."
  (cd frontend && npm install && npm run build)
fi

echo ">> Starting RansomTime-X on http://localhost:8000"
cd backend
pip install -q -r requirements.txt 2>/dev/null || true
exec uvicorn main:app --host 0.0.0.0 --port 8000
