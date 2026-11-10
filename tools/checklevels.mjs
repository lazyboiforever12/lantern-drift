// Checks every built-in level map with the same rules the in-game editor uses
// (src/levels.js checkLevel), plus equal row widths. Run: node tools/checklevels.mjs
import { LEVELS, parseLevel, checkLevel } from '../src/levels.js';

let problems = 0;
for (const def of LEVELS) {
  const issues = [...checkLevel(def)];
  def.map.forEach((r, i) => {
    if (r.length !== def.map[0].length) issues.push(`row ${i} is ${r.length} wide, expected ${def.map[0].length}`);
  });
  const L = parseLevel(def);
  console.log(`${def.name}: ${L.width}x${L.height}, ${L.buoys.length} buoys, ${L.oils.length} oil, ${L.creatures.length} shadows`);
  for (const msg of issues) {
    problems++;
    console.log(`  x ${msg}`);
  }
}
console.log(problems ? `${problems} problem(s)` : 'All levels OK');
process.exitCode = problems ? 1 : 0;
