// Cache-busting for the published game. GitHub Pages lets browsers keep each file for a few
// minutes, so right after an update a player could get new main.js with an old levels.js, and
// the imports would break. This writes an import map into index.html that adds a short hash of
// each file's contents to its URL (src/levels.js -> src/levels.js?v=1a2b3c4d), plus the same for
// style.css and main.js. A changed file gets a new URL; unchanged files stay cached.
// Run: node tools/stamp.mjs   (the tests fail if you forget after changing a file)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
// Line endings are normalised first, so a Windows checkout (CRLF) gives the same hash as the repo (LF).
const hash = (path) => createHash('sha256')
  .update(readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);

export function stampedHtml() {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const files = readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.js')).sort();
  const imports = Object.fromEntries(files.map((f) => [`./src/${f}`, `./src/${f}?v=${hash(`src/${f}`)}`]));
  const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n  </script>`;
  // modulepreload: fetch every module at once, instead of finding them one import at a time.
  const preloads = files.map((f) => `<link rel="modulepreload" href="src/${f}?v=${hash(`src/${f}`)}">`).join('\n  ');
  let out = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, ''); // drop the old map (run twice: same result)
  out = out.replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  out = out.replace(/<link rel="stylesheet" href="style\.css[^"]*">/, `<link rel="stylesheet" href="style.css?v=${hash('style.css')}">\n  ${map}\n  ${preloads}`);
  out = out.replace(/<script type="module" src="src\/main\.js[^"]*"><\/script>/, `<script type="module" src="src/main.js?v=${hash('src/main.js')}"></script>`);
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}`) {
  writeFileSync(new URL('index.html', root), stampedHtml());
  console.log('index.html stamped');
}
