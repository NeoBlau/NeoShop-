#!/usr/bin/env bash
# «Буран-М: Одиссея» — запуск: ./start-linux.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите Node.js 18+ (https://nodejs.org или пакетный менеджер)."
  exit 1
fi
exec node tools/launch.mjs
