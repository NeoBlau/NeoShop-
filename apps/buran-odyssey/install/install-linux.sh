#!/usr/bin/env bash
# «Буран-М: Одиссея» — установка на Linux (x64 и arm64), без sudo.
#
#   curl -fsSL https://raw.githubusercontent.com/NeoBlau/NeoShop-/claude/affectionate-gauss-hor809/apps/buran-odyssey/install/install-linux.sh | bash
#
# или с уже скачанным ZIP:   bash install-linux.sh ~/Загрузки/NeoShop-….zip
#
# Если Node.js 18+ нет, ставит официальную сборку в ~/.local/share/buran-node.
set -euo pipefail

REPO="NeoBlau/NeoShop-"
BRANCH="${BURAN_BRANCH:-claude/affectionate-gauss-hor809}"
DEST="${BURAN_DIR:-$HOME/Games/BuranM}"
ZIP_ARG="${1:-}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "нужна программа $1 (установите её пакетным менеджером)"; }
need curl
need unzip
need tar

NODE=""
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then
  NODE=$(command -v node)
else
  say "Устанавливаю Node.js LTS в ~/.local/share/buran-node"
  case "$(uname -m)" in
    x86_64) ARCH=x64 ;;
    aarch64 | arm64) ARCH=arm64 ;;
    *) die "архитектура $(uname -m) не поддерживается сборками Node.js" ;;
  esac
  BASE="https://nodejs.org/dist/latest-v22.x"
  LINE=$(curl -fsSL "$BASE/SHASUMS256.txt" | awk "/linux-$ARCH\\.tar\\.xz\$/ {print; exit}")
  [ -n "$LINE" ] || die "не удалось получить список версий Node.js"
  SUM=${LINE%% *}
  FILE=${LINE##* }
  curl -fL "$BASE/$FILE" -o "/tmp/$FILE"
  echo "$SUM  /tmp/$FILE" | sha256sum -c - >/dev/null || die "контрольная сумма Node.js не совпала"
  NODE_HOME="$HOME/.local/share/buran-node"
  rm -rf "$NODE_HOME"
  mkdir -p "$NODE_HOME"
  tar -xJf "/tmp/$FILE" -C "$NODE_HOME" --strip-components=1
  rm -f "/tmp/$FILE"
  NODE="$NODE_HOME/bin/node"
fi
echo "Node.js $("$NODE" -v)"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
if [ -n "$ZIP_ARG" ]; then
  cp "$ZIP_ARG" "$TMP/buran.zip"
else
  say "Скачиваю игру из GitHub"
  curl -fL "https://codeload.github.com/$REPO/zip/refs/heads/$BRANCH" -o "$TMP/buran.zip" ||
    die "не удалось скачать. Если репозиторий приватный: скачайте ZIP в браузере и запустите: bash install-linux.sh путь/к/файлу.zip"
fi
unzip -q "$TMP/buran.zip" -d "$TMP"
SRC=$(find "$TMP" -maxdepth 3 -type d -path '*/apps/buran-odyssey' | head -1)
[ -n "$SRC" ] || die "в архиве нет apps/buran-odyssey"

for keep in assets vendor; do
  if [ -d "$DEST/$keep" ]; then mv "$DEST/$keep" "$TMP/keep-$keep"; fi
done
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -R "$SRC" "$DEST"
for keep in assets vendor; do
  if [ -d "$TMP/keep-$keep" ]; then rm -rf "${DEST:?}/$keep" && mv "$TMP/keep-$keep" "$DEST/$keep"; fi
done
chmod +x "$DEST/start-linux.sh"

cd "$DEST"
if [ ! -f assets/manifest.json ]; then
  say "Скачиваю текстуры (~30 МБ)"
  "$NODE" tools/fetch-assets.mjs || echo "Не получилось — игра будет брать текстуры из интернета."
fi

# Пункт в меню приложений
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
cat > "$APPS/buran-m.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Буран-М: Одиссея
Comment=Научный космический симулятор
Exec="$NODE" "$DEST/tools/launch.mjs"
Path=$DEST
Terminal=true
Categories=Game;Simulation;Education;
DESKTOP

say "Готово. Игра: $DEST, в меню приложений — «Буран-М: Одиссея»"
exec "$NODE" "$DEST/tools/launch.mjs"
