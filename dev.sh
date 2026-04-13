#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping any running backend / frontend processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "  backend stopped" || true
pkill -f "vite"                 2>/dev/null && echo "  frontend stopped" || true
sleep 1

exec npx concurrently \
  --names "backend,frontend" \
  --prefix-colors "bgBlue.bold,bgGreen.bold" \
  --kill-others-on-fail \
  "cd '$ROOT/backend' && uvicorn app.main:app --reload --port 8000" \
  "cd '$ROOT/frontend' && npm run dev"
