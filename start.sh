#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/backend"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
