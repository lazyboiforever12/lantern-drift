// Achievements: goals that pay Embers when you reach them. Progress lives in the save
// (save.achievements = { id: date unlocked }, save.stats = running totals).
// The game reports what happens through record() and check(); this file decides what unlocks.

export const ACHIEVEMENTS = [
  { id: 'firstLight', name: 'First Light', desc: 'Light your first buoy', embers: 20 },
  { id: 'harbour', name: 'Safe Harbour', desc: 'Clear any level', embers: 30 },
  { id: 'flares10', name: 'Signal Fire', desc: 'Fire 10 flares', embers: 25 },
  { id: 'flares100', name: 'Fireworks Fan', desc: 'Fire 100 flares', embers: 60 },
  { id: 'tripleStun', name: 'Crowd Control', desc: 'Stun 3 shadows with one flare', embers: 60 },
  { id: 'untouched', name: 'Untouchable', desc: 'Clear a level without a shadow stealing oil', embers: 80 },
  { id: 'thrifty', name: 'Thrifty', desc: 'Clear a level with three quarters of your oil left', embers: 60 },
  { id: 'closeCall', name: 'Running on Fumes', desc: 'Clear a level with less than 10% oil', embers: 60 },
  { id: 'speedy', name: 'Market Dash', desc: 'Clear The Flooded Market in under 40 seconds', embers: 60 },
  { id: 'stormChaser', name: 'Storm Chaser', desc: 'Get lightning to stun a shadow', embers: 50 },
  { id: 'collector', name: 'Oil Baron', desc: 'Pick up 50 oil cans', embers: 50 },
  { id: 'lamplighter', name: 'Lamplighter', desc: 'Light 100 buoys', embers: 80 },
  { id: 'fullRun', name: 'The Town Is Lit', desc: 'Finish every story level in one run', embers: 150 },
  { id: 'daily', name: 'Daily Sailor', desc: 'Complete a Daily Voyage', embers: 40 },
  { id: 'streak3', name: 'Three in a Row', desc: 'Clear the Daily Voyage three days running', embers: 100 },
  { id: 'voyage5', name: 'Open Water', desc: 'Reach voyage 5 in Endless', embers: 80 },
  { id: 'voyage10', name: 'Far Horizon', desc: 'Reach voyage 10 in Endless', embers: 200 },
  { id: 'treasure', name: 'Treasure Hunter', desc: 'Collect 25 ember shards', embers: 75 },
  { id: 'drain', name: 'Down the Drain', desc: 'Lure a shadow into a whirlpool', embers: 50 },
  { id: 'bruteStun', name: 'The Bigger They Are', desc: 'Stun a brute with a second flare', embers: 60 },
  { id: 'architect', name: 'Architect', desc: 'Beat a level from the editor', embers: 50 },
  { id: 'shipowner', name: 'Shipowner', desc: 'Buy a new boat in the Boatyard', embers: 20 },
  { id: 'fleet', name: 'Admiral', desc: 'Own 10 boats', embers: 150 },
  { id: 'painter', name: 'Fresh Coat', desc: 'Get a new paint colour', embers: 15 },
  { id: 'tinkerer', name: 'Tinkerer', desc: 'Max out any upgrade', embers: 60 },
  { id: 'nightOwl', name: 'Night Owl', desc: 'Sail for 30 minutes in total', embers: 40 },
  { id: 'floodgates', name: 'Lock Keeper', desc: 'Sink a set of floodgates', embers: 30 },
  { id: 'eclipse', name: 'Blood Moon', desc: 'Sail through a whole eclipse', embers: 40 },
  { id: 'keeper', name: 'The Last Keeper', desc: "Finish act II and bring the keeper's lantern home", embers: 200 },
];

export class Achievements {
  // save: the game's save object. onUnlock(achievement) is called once per new unlock.
  constructor(save, onUnlock) {
    this.save = save;
    save.achievements = save.achievements || {};
    save.stats = save.stats || {};
    this.onUnlock = onUnlock;
  }

  get stats() { return this.save.stats; }
  has(id) { return !!this.save.achievements[id]; }
  get count() { return Object.keys(this.save.achievements).length; }

  unlock(id) {
    if (this.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.save.achievements[id] = Date.now();
    this.onUnlock(a);
  }

  // Add to a running total, then unlock anything that total has earned.
  record(stat, amount = 1) {
    const s = this.stats;
    s[stat] = (s[stat] || 0) + amount;
    const goals = {
      buoys: [[1, 'firstLight'], [100, 'lamplighter']],
      flares: [[10, 'flares10'], [100, 'flares100']],
      oils: [[50, 'collector']],
      shards: [[25, 'treasure']],
      playTime: [[1800, 'nightOwl']],
    }[stat] || [];
    for (const [n, id] of goals) if (s[stat] >= n) this.unlock(id);
  }

  // A level (or voyage) was cleared. info: { kind, levelIndex, time, oilPct, hits, fullRun }
  cleared(info) {
    this.unlock('harbour');
    if (info.hits === 0) this.unlock('untouched');
    if (info.oilPct >= 75) this.unlock('thrifty');
    if (info.oilPct < 10) this.unlock('closeCall');
    if (info.kind === 'story' && info.levelIndex === 0 && info.time < 40) this.unlock('speedy');
    if (info.fullRun) this.unlock('fullRun');
    if (info.kind === 'custom') this.unlock('architect');
    if (info.kind === 'daily') {
      this.unlock('daily');
      if (info.streak >= 3) this.unlock('streak3');
    }
    if (info.kind === 'endless') {
      if (info.voyage >= 5) this.unlock('voyage5');
      if (info.voyage >= 10) this.unlock('voyage10');
    }
  }

  // The Boatyard changed: check boats owned, upgrades and paints.
  boatyard(yard, freePaints) {
    const owned = Object.values(yard.boats);
    if (owned.length >= 2) this.unlock('shipowner');
    if (owned.length >= 10) this.unlock('fleet');
    if (owned.some((b) => b.engine >= 3 || b.tank >= 3 || b.burner >= 3 || b.lens >= 3)) this.unlock('tinkerer');
    if (yard.paints.length > freePaints) this.unlock('painter');
  }
}
