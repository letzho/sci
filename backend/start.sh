#!/usr/bin/env bash
# Render: start Express API + optional Flask ML sidecar on 127.0.0.1:5001
# ML failures never block the Node API from starting.
set -euo pipefail
cd "$(dirname "$0")"

ML_HOST="${ML_HOST:-127.0.0.1}"
ML_PORT="${ML_PORT:-5001}"
export ML_HOST ML_PORT

pick_python() {
  for cmd in python3.12 python3.11 python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
      echo "$cmd"
      return 0
    fi
  done
  return 1
}

pip_flags() {
  local py="$1"
  if "$py" -m pip install --help 2>&1 | grep -q break-system-packages; then
    echo "--break-system-packages"
  fi
}

ml_deps_ready() {
  local py="$1"
  "$py" -c "import flask, joblib, sklearn" >/dev/null 2>&1
}

wait_for_ml() {
  node -e "
    const url = 'http://${ML_HOST}:${ML_PORT}/health';
    (async () => {
      for (let i = 0; i < 45; i++) {
        try {
          const r = await fetch(url);
          const d = await r.json();
          if (r.ok && d.ok) process.exit(0);
          if (d.error) console.error('[start] ML health:', d.error);
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 1000));
      }
      process.exit(1);
    })();
  " && echo "[start] ML sidecar ready" || echo "[start] ML sidecar not ready — run: bash scripts/ml-diagnose.sh (or switch to Docker; see RENDER.md)"
}

start_ml() {
  if [ ! -f ml/requirements.txt ]; then
    return 0
  fi

  local PY
  if ! PY=$(pick_python); then
    echo "[start] Python not found on this runtime — premium ML disabled."
    echo "[start] Fix: Render Dashboard → Settings → Environment = Docker, Root Directory = backend (see RENDER.md)."
    return 0
  fi

  echo "[start] Using $PY ($($PY --version 2>&1))"
  local PIP_EXTRA
  PIP_EXTRA=$(pip_flags "$PY")

  if ! ml_deps_ready "$PY"; then
    echo "[start] Installing ML dependencies (pip install -r ml/requirements.txt)…"
    if ! "$PY" -m pip install --upgrade $PIP_EXTRA pip setuptools wheel; then
      echo "[start] pip bootstrap failed — ML disabled"
      return 0
    fi
    if ! "$PY" -m pip install $PIP_EXTRA -r ml/requirements.txt; then
      echo "[start] pip install failed — ML disabled."
      echo "[start] Native Node runtime often lacks a compatible Python. Use Docker deploy (backend/Dockerfile)."
      return 0
    fi
  else
    echo "[start] ML dependencies already installed"
  fi

  "$PY" ml/app.py &
  echo "[start] ML sidecar starting on ${ML_HOST}:${ML_PORT} (pid $!)"
  wait_for_ml || true
}

start_ml
exec node server.js
