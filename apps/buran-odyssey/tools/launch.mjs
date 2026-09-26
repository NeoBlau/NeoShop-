// One-click start used by the launchers (start-windows.bat,
// start-macos.command, start-linux.sh):
//  1. on first run, downloads textures and three.js for offline play;
//  2. starts the local server on a free port;
//  3. opens the game in the default browser.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, startServer } from './serve.mjs';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(
    `Нужен Node.js 18 или новее (у вас ${process.version}). Скачайте LTS: https://nodejs.org`,
  );
  process.exit(1);
}

if (!existsSync(join(root, 'assets', 'manifest.json'))) {
  console.log('Первый запуск: скачиваю текстуры и three.js для игры без интернета…');
  const r = spawnSync(process.execPath, [join(root, 'tools', 'fetch-assets.mjs')], {
    stdio: 'inherit',
  });
  if (r.status !== 0)
    console.log('Скачать не удалось: игра будет брать ресурсы из интернета (CDN).');
}

const port = await startServer(8080);
const url = `http://localhost:${port}`;
console.log(`\nБуран-М: Одиссея запущена — ${url}`);
console.log('Не закрывайте это окно во время игры. Выход: Ctrl+C или закрыть окно.\n');

const opener =
  process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : ['xdg-open', [url]];
try {
  // windowsVerbatimArguments keeps the empty `start` title ("") intact.
  spawn(opener[0], opener[1], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true })
    .on('error', () => {
      console.log(`Откройте в браузере: ${url}`);
    })
    .unref();
} catch {
  console.log(`Откройте в браузере: ${url}`);
}
