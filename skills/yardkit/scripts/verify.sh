#!/usr/bin/env bash
# yardkit 验收：node 检查 + 浏览器 demo + 内核 md5。
# 用法：bash scripts/verify.sh [--quick]
set -uo pipefail
KIT="${KIT:-/home/wxr/.project/yardkit}"
cd "$KIT" || { echo "kit not found: $KIT"; exit 2; }

echo "== 1/3 node checks"
node test/check.mjs | tail -3
node_rc=${PIPESTATUS[0]}

if [[ "${1:-}" != "--quick" ]]; then
  echo "== 2/3 browser demos"
  node test/render.mjs | tail -20
  render_rc=${PIPESTATUS[0]}
else
  echo "== 2/3 browser demos (skipped)"
  render_rc=0
fi

echo "== 3/3 kernel untouched"
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

exit $(( node_rc || render_rc || md5_rc ))
