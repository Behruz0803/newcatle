#!/bin/sh
set -eu
cd "$(dirname "$0")"
PORT="${PORT:-3000}"

if [ "${OPEN_BROWSER:-1}" != "0" ]; then
  (sleep 1; xdg-open "http://localhost:${PORT}" 2>/dev/null || open "http://localhost:${PORT}" 2>/dev/null || true) &
fi

exec node server.js
