#!/usr/bin/env bash
# yardkit verification: node checks + typecheck + browser demos + kernel md5.
# Usage: bash scripts/verify.sh [--quick]
set -uo pipefail
KIT="${KIT:-/home/wxr/.project/yardkit}"
cd "$KIT" || { echo "kit not found: $KIT"; exit 2; }

echo "== 1/4 node checks"
node test/check.mjs | tail -3
node_rc=${PIPESTATUS[0]}

echo "== 2/4 typecheck"
npm run typecheck
type_rc=$?

if [[ "${1:-}" != "--quick" ]]; then
  echo "== 3/4 browser demos"
  node test/render.mjs | tail -20
  render_rc=${PIPESTATUS[0]}
else
  echo "== 3/4 browser demos (skipped)"
  render_rc=0
fi

echo "== 4/4 kernel untouched"
if [[ -f /tmp/kit-src-baseline.txt ]]; then
  if md5sum -c /tmp/kit-src-baseline.txt 2>&1 | grep -q 'FAILED'; then
    echo "FAIL: kernel files changed"
    md5_rc=1
  else
    echo "kernel unchanged"
    md5_rc=0
  fi
else
  echo "no baseline; run: md5sum src/*.js src/materials/*.js assets/glsl/*.glsl > /tmp/kit-src-baseline.txt"
  md5_rc=0
fi

exit $(( node_rc || type_rc || render_rc || md5_rc ))
