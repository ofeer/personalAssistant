#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PY="$ROOT/backend/.venv/bin/python"

if [[ ! -x "$BACKEND_PY" ]]; then
  echo "Backend virtualenv not found at backend/.venv." >&2
  echo "Create it and install dependencies:" >&2
  echo "  cd \"$ROOT/backend\" && /usr/bin/python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

echo "Stopping any running backend / frontend processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "  backend stopped" || true
pkill -f "vite"                 2>/dev/null && echo "  frontend stopped" || true
sleep 1

exec npx concurrently \
  --names "backend,frontend" \
  --prefix-colors "bgBlue.bold,bgGreen.bold" \
  --kill-others-on-fail \
  "cd '$ROOT/backend' && '$BACKEND_PY' -m uvicorn app.main:app --reload --port 8000" \
  "cd '$ROOT/frontend' && npm run dev"
