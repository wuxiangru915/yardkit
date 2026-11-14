#!/usr/bin/env bash
cd "$(dirname "$0")/.."
exec python3 -m http.server "${1:-8151}" --bind 127.0.0.1
