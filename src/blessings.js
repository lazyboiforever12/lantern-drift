// Blessings: after each voyage cleared in Endless, pick one of three. They last for the rest of
// that run and stack, so every run builds a little differently. Each one nudges a boat stat
// (the same stats the Boatyard boats and upgrades use, see boats.js).

export const BLESSINGS = [
  { id: 'tank', name: 'Deep Tank', icon: '\u{1F6E2}', desc: '+25% oil tank', apply: (s) => { s.tank *= 1.25; } },
  { id: 'oars', name: 'Strong Oars', icon: '\u{1F6A3}', desc: '+10% speed and acceleration', apply: (s) => { s.maxSpeed *= 1.1; s.thrust *= 1.1; } },
  { id: 'wick', name: 'Slow Wick', icon: '\u{1F56F}', desc: 'The lantern burns 12% slower', apply: (s) => { s.drain *= 0.88; } },
  { id: 'flare', name: 'Cheap Flares', icon: '✨', desc: 'Flares cost 30% less oil', apply: (s) => { s.flareCost *= 0.7; } },
  { id: 'reach', name: 'Long Flares', icon: '\u{1F387}', desc: 'Flares reach 25% further', apply: (s) => { s.flareRange *= 1.25; } },
  { id: 'match', name: 'Quick Match', icon: '\u{1F525}', desc: 'Flares recharge 30% faster', apply: (s) => { s.flareCooldown *= 0.7; } },
  { id: 'dazzle', name: 'Dazzle', icon: '\u{1F4AB}', desc: 'Stunned shadows stay stunned 40% longer', apply: (s) => { s.stunMult *= 1.4; } },
  { id: 'finder', name: 'Oil Finder', icon: '\u{1F9ED}', desc: 'Oil cans give 30% more', apply: (s) => { s.pickup *= 1.3; } },
  { id: 'pole', name: 'Long Pole', icon: '\u{1F6A9}', desc: 'Light buoys from 40% further away', apply: (s) => { s.buoyRange *= 1.4; } },
  { id: 'hull', name: 'Tough Hull', icon: '\u{1F6E1}', desc: 'Shadows steal 25% less oil', apply: (s) => { s.hitMult *= 0.75; } },
  { id: 'lens', name: 'Wide Lens', icon: '\u{1F506}', desc: 'Your lantern shines 15% wider', apply: (s) => { s.lantern *= 1.15; } },
  { id: 'keel', name: 'Deep Keel', icon: '⚓', desc: 'Sharper turns and less sliding', apply: (s) => { s.turn *= 1.12; s.grip *= 1.2; } },
];

export const blessingById = (id) => BLESSINGS.find((b) => b.id === id);

// Three different blessings, chosen with the given random function.
export function rollBlessings(random = Math.random, count = 3) {
  const pool = BLESSINGS.slice();
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

// A copy of the stats with the blessings applied (the original is left alone).
export function applyBlessings(stats, ids) {
  const s = { ...stats };
  for (const id of ids) blessingById(id)?.apply(s);
  return s;
}
