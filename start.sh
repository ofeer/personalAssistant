#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "$ROOT/backend" ]]; then
  cd "$ROOT/backend"
fi
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
