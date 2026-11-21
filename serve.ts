// Shadow Lantern — a tiny static server for local play-testing only.
// Serves game/ at http://localhost:8080 (game/index.html). Not part of the
// entry: the game itself is plain static files with no build step.
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('game', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer((req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).on('error', () => { res.writeHead(404); res.end('not found'); }).pipe(res);
}).listen(8080, () => console.log('Shadow Lantern at http://localhost:8080'));
