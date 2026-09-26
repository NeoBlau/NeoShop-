// Minimal static server: ES modules and workers need http(s), not file://.
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// fileURLToPath, not URL.pathname: the latter breaks on Windows drive letters
// and on folders with spaces or Cyrillic names ("Загрузки").
export const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
};

async function handle(req, res) {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/') || path.endsWith(sep)) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) throw new Error('outside root');
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('not found');
  }
}

// Listens on `port`, or the next free one if it is taken. Resolves to the port.
export function startServer(port = 8080, attempts = 20) {
  return new Promise((resolve, reject) => {
    const server = createServer(handle);
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE' && attempts > 1) resolve(startServer(port + 1, attempts - 1));
      else reject(e);
    });
    server.listen(port, '127.0.0.1', () => resolve(port));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = await startServer(Number(process.argv[2]) || 8080);
  console.log(`Буран-М: http://localhost:${port}`);
}
