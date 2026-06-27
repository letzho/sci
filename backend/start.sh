#!/usr/bin/env bash
set -e

# Render start script: Flask ML sidecar (internal) + Express API (public PORT)
cd "$(dirname "$0")"

if [ -f ml/requirements.txt ]; then
  pip install -r ml/requirements.txt --quiet
  ML_HOST=127.0.0.1 ML_PORT=5001 python ml/app.py &
fi

node server.js
