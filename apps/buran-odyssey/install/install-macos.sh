#!/bin/bash
# «Буран-М: Одиссея» — установка на macOS (Intel и Apple Silicon).
#
#   curl -fsSL https://raw.githubusercontent.com/NeoBlau/NeoShop-/claude/affectionate-gauss-hor809/apps/buran-odyssey/install/install-macos.sh | bash
#
# или, если ZIP уже скачан вручную:   bash install-macos.sh ~/Downloads/NeoShop-….zip
#
# Что делает: ставит Node.js LTS (если его нет), кладёт игру в ~/Games/BuranM,
# скачивает текстуры для игры без интернета, создаёт ярлык на рабочем столе
# и запускает игру. Повторный запуск обновляет игру, сохраняя скачанные текстуры.
set -euo pipefail

REPO="NeoBlau/NeoShop-"
BRANCH="${BURAN_BRANCH:-claude/affectionate-gauss-hor809}"
DEST="${BURAN_DIR:-$HOME/Games/BuranM}"
ZIP_ARG="${1:-}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$1" >&2; exit 1; }

node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]
}

# 1. Node.js -------------------------------------------------------------------
if ! node_ok; then
  say "Устанавливаю Node.js LTS (macOS спросит пароль администратора)"
  BASE="https://nodejs.org/dist/latest-v22.x"
  LINE=$(curl -fsSL "$BASE/SHASUMS256.txt" | awk '/\.pkg$/ {print; exit}')
  [ -n "$LINE" ] || die "не удалось получить список версий Node.js"
  SUM=${LINE%% *}
  PKG=${LINE##* }
  curl -fL "$BASE/$PKG" -o "/tmp/$PKG"
  echo "$SUM  /tmp/$PKG" | shasum -a 256 -c - >/dev/null || die "контрольная сумма Node.js не совпала"
  sudo installer -pkg "/tmp/$PKG" -target /
  rm -f "/tmp/$PKG"
  export PATH="/usr/local/bin:$PATH"
  node_ok || die "Node.js не установился"
fi
echo "Node.js $(node -v)"

# 2. Игра ----------------------------------------------------------------------
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
if [ -n "$ZIP_ARG" ]; then
  say "Распаковываю $ZIP_ARG"
  cp "$ZIP_ARG" "$TMP/buran.zip"
else
  say "Скачиваю игру из GitHub"
  curl -fL "https://codeload.github.com/$REPO/zip/refs/heads/$BRANCH" -o "$TMP/buran.zip" ||
    die "не удалось скачать. Если репозиторий приватный: скачайте ZIP в браузере (Code → Download ZIP) и запустите: bash install-macos.sh путь/к/файлу.zip"
fi
unzip -q "$TMP/buran.zip" -d "$TMP"
SRC=$(find "$TMP" -maxdepth 3 -type d -path '*/apps/buran-odyssey' | head -1)
[ -n "$SRC" ] || die "в архиве нет apps/buran-odyssey"

# Скачанные текстуры переживают обновление.
for keep in assets vendor; do
  if [ -d "$DEST/$keep" ]; then mv "$DEST/$keep" "$TMP/keep-$keep"; fi
done
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -R "$SRC" "$DEST"
for keep in assets vendor; do
  if [ -d "$TMP/keep-$keep" ]; then rm -rf "${DEST:?}/$keep" && mv "$TMP/keep-$keep" "$DEST/$keep"; fi
done
chmod +x "$DEST/start-macos.command"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

# 3. Текстуры для офлайна -----------------------------------------------------
cd "$DEST"
if [ ! -f assets/manifest.json ]; then
  say "Скачиваю текстуры (~30 МБ)"
  node tools/fetch-assets.mjs || echo "Не получилось — игра будет брать текстуры из интернета."
fi

# 4. Ярлык на рабочем столе ------------------------------------------------------
LINK="$HOME/Desktop/Буран-М.command"
printf '#!/bin/bash\nexec "%s/start-macos.command"\n' "$DEST" > "$LINK"
chmod +x "$LINK"

say "Готово. Игра: $DEST, ярлык: «Буран-М» на рабочем столе"
exec "$DEST/start-macos.command"
