#!/bin/bash
# «Буран-М: Одиссея» — запуск двойным щелчком в Finder.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите LTS с https://nodejs.org и запустите снова."
  open "https://nodejs.org"
  read -r -p "Нажмите Enter…"
  exit 1
fi
node tools/launch.mjs
