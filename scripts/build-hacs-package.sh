#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run build

rm -rf build/hacs music_assistant_dashboard.zip
mkdir -p build/hacs/frontend

cp -a custom_components/music_assistant_dashboard/. build/hacs/
cp dist/music-assistant-dashboard-card.js build/hacs/frontend/music-assistant-dashboard-card.js
find build/hacs -type d -name '__pycache__' -prune -exec rm -rf {} +
find build/hacs -type f -name '*.pyc' -delete

(
  cd build/hacs
  zip -qr ../../music_assistant_dashboard.zip .
)

echo "Built $ROOT/music_assistant_dashboard.zip"
