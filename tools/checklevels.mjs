// Checks every level map: rows the same width, closed outer walls, and that the boat can
// reach every buoy, oil can and the lighthouse. Run: node tools/checklevels.mjs
import { LEVELS, parseLevel } from '../src/levels.js';

let problems = 0;
const fail = (level, msg) => { problems++; console.log(`  ✗ ${level}: ${msg}`); };

for (const def of LEVELS) {
  const widths = new Set(def.map.map((r) => r.length));
  if (widths.size > 1) {
    def.map.forEach((r, i) => {
      if (r.length !== def.map[0].length) fail(def.name, `row ${i} is ${r.length} wide, expected ${def.map[0].length}`);
    });
  }
  const L = parseLevel(def);
  const { grid, width, height, cell } = L;
  const solid = (c, r) => r < 0 || c < 0 || r >= height || c >= width || grid[r][c] === '#' || grid[r][c] === 'L';
  for (let c = 0; c < width; c++) if (!solid(c, 0) || !solid(c, height - 1)) fail(def.name, `gap in top/bottom wall at column ${c}`);
  for (let r = 0; r < height; r++) if (!solid(0, r) || !solid(width - 1, r)) fail(def.name, `gap in side wall at row ${r}`);

  // Flood fill from the start.
  const seen = new Set();
  const start = [Math.floor(L.start.x / cell), Math.floor(L.start.z / cell)];
  const queue = [start];
  seen.add(start.join());
  for (let i = 0; i < queue.length; i++) {
    const [c, r] = queue[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${c + dc},${r + dr}`;
      if (!seen.has(k) && !solid(c + dc, r + dr)) { seen.add(k); queue.push([c + dc, r + dr]); }
    }
  }
  const at = (p) => `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
  L.buoys.forEach((p, i) => { if (!seen.has(at(p))) fail(def.name, `buoy ${i} can't be reached`); });
  L.oils.forEach((p, i) => { if (!seen.has(at(p))) fail(def.name, `oil ${i} can't be reached`); });
  const [lc, lr] = at(L.lighthouse).split(',').map(Number);
  const lighthouseOk = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${lc + dc},${lr + dr}`));
  if (!lighthouseOk) fail(def.name, 'lighthouse has no reachable water next to it');
  console.log(`${def.name}: ${width}x${height}, ${L.buoys.length} buoys, ${L.oils.length} oil, ${L.creatures.length} shadows`);
}
console.log(problems ? `${problems} problem(s)` : 'All levels OK');
process.exitCode = problems ? 1 : 0;
