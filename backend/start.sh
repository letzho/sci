#!/usr/bin/env bash
# Render: start Express API. ML sidecar is optional — never block Node if Python missing.
cd "$(dirname "$0")"

start_ml() {
  if [ ! -f ml/requirements.txt ]; then return 0; fi
  if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
    echo "[start] Python not found — premium ML disabled; API will still run."
    return 0
  fi
  PY=python3
  command -v python3 >/dev/null 2>&1 || PY=python
  PIP=pip3
  command -v pip3 >/dev/null 2>&1 || PIP=pip
  $PIP install -r ml/requirements.txt --quiet 2>/dev/null || echo "[start] pip install failed — ML disabled"
  ML_HOST=127.0.0.1 ML_PORT=5001 $PY ml/app.py &
  echo "[start] ML sidecar starting on 127.0.0.1:5001"
}

start_ml
exec node server.js
