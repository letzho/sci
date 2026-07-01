#!/usr/bin/env bash
# Run in Render Shell (Root Directory = backend) to see why ML is offline.
set -u
cd "$(dirname "$0")/.."

echo "=== ML diagnose (Render) ==="
echo "PWD: $(pwd)"
echo ""

for cmd in python3.12 python3.11 python3 python; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "Found: $cmd -> $($cmd --version 2>&1)"
  fi
done
echo ""

PY=""
for cmd in python3.12 python3.11 python3 python; do
  if command -v "$cmd" >/dev/null 2>&1; then PY=$cmd; break; fi
done

if [ -z "$PY" ]; then
  echo "RESULT: No Python on this runtime."
  echo "FIX: Switch service Environment to Docker (Root Directory = backend, Dockerfile = Dockerfile)."
  exit 1
fi

PIP_EXTRA=""
if $PY -m pip install --help 2>&1 | grep -q break-system-packages; then
  PIP_EXTRA="--break-system-packages"
fi

echo "Installing ML deps…"
if ! $PY -m pip install $PIP_EXTRA -r ml/requirements.txt; then
  echo "RESULT: pip install failed (see errors above)."
  echo "FIX: Use Docker deploy — Node runtime Python is often too new or missing build tools."
  exit 1
fi

echo ""
echo "Loading models…"
$PY -c "
from pathlib import Path
import joblib
d = Path('ml/models')
for name in ('insurance_model.pkl', 'column_transformer.pkl'):
    p = d / name
    print(f'  {name}:', 'ok' if p.is_file() else 'MISSING')
joblib.load(d / 'insurance_model.pkl')
joblib.load(d / 'column_transformer.pkl')
print('  unpickle: ok')
"

echo ""
echo "Starting Flask briefly on :5001 (Ctrl+C if interactive)…"
ML_HOST=127.0.0.1 ML_PORT=5001 timeout 8 $PY ml/app.py &
sleep 3
node -e "fetch('http://127.0.0.1:5001/health').then(r=>r.json()).then(d=>console.log('health:', d)).catch(e=>console.error('health failed:', e.message))" || true
wait 2>/dev/null || true

echo ""
echo "If health shows ok:true, ML works — redeploy with Docker so it survives restarts."
