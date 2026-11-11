// Tiny static file server so the game's ES modules load in the browser.
// Usage: node serve.mjs   (then open http://localhost:5173)
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Dev helper: pressing F9 in the game POSTs a PNG here and it's saved in screenshots/.
async function saveScreenshot(req, res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) {
      res.writeHead(413).end('Too big');
      return;
    }
    chunks.push(chunk);
  }
  const png = Buffer.concat(chunks);
  // MP4 gameplay clips (recorded in the browser for store pages) are saved too.
  const isMp4 = png.subarray(4, 8).toString() === 'ftyp';
  if (png.subarray(1, 4).toString() !== 'PNG' && !isMp4) {
    res.writeHead(400).end('Not a PNG or MP4');
    return;
  }
  const dir = join(root, 'screenshots');
  await mkdir(dir, { recursive: true });
  const name = `lantern-drift-${new Date().toISOString().replace(/[:.]/g, '-')}.${isMp4 ? 'mp4' : 'png'}`;
  await writeFile(join(dir, name), png);
  console.log(`Saved screenshots/${name}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`screenshots/${name}`);
}

http
  .createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/screenshot') {
      saveScreenshot(req, res).catch(() => res.writeHead(500).end('Could not save'));
      return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Lantern Drift running at http://localhost:${port}`));
