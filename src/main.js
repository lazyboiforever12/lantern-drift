// Entry point: input, game states, HUD and the main loop.
import { Renderer } from './render.js';
import { Game } from './game.js';
import { LEVELS, decodeShare } from './levels.js';
import { createEditor } from './editor.js';
import { createShop } from './shop.js';
import { BOATS, boatById, boatStats, boatPaint, defaultBoatyard } from './boats.js';
import { Sound } from './audio.js';
import { generateVoyage, dailyVoyage, todayKey } from './voyages.js';
import { Achievements, ACHIEVEMENTS } from './achievements.js';
import { createAutopilot } from './autopilot.js';
import { rollBlessings, applyBlessings, blessingById } from './blessings.js';
import { Minimap } from './minimap.js';

const canvas = document.getElementById('game');
const hudEl = document.getElementById('hud');
const screenEl = document.getElementById('screen');

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  screenEl.innerHTML = `<h1>Lantern Drift</h1><p>Sorry, this game needs WebGL2.</p><pre>${err.message}</pre>`;
  throw err;
}

const sound = new Sound();
const keys = new Set();
let state = 'title'; // title | playing | paused | levelClear | gameOver | won | settings | editor | customClear | shop
                     // | voyageClear | voyageOver | dailyClear
let voyage = null;   // set while on a generated voyage: { kind: 'endless' | 'daily', depth, seed }
let customDef = null; // set while playing a level from the editor
let levelIndex = 0;
let game = null; // created once the saved boat is loaded (below)
let time = 0;
let last = performance.now();
let message = '';
let messageTimer = 0;

// ---------- Saved progress (which levels are unlocked, best times) ----------
const SAVE_KEY = 'lanternDrift.save.v1';
function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    // Keep everything in the save (Boatyard, streaks, achievements...), not just the level progress.
    if (data && typeof data.unlocked === 'number') return { ...data, best: data.best || {} };
  } catch { /* private mode or bad data: start fresh */ }
  return { unlocked: 1, best: {} };
}
const save = loadSave();
// Save version 2: two levels were added before Lighthouse Point (it moved from slot 7 to 9).
// Move its best time, and keep everything a player had unlocked open.
if ((save.version || 1) < 2) {
  if (save.best[6] !== undefined) {
    save.best[8] = save.best[6];
    delete save.best[6];
  }
  if (save.unlocked >= 7) save.unlocked += 2;
  save.version = 2;
  writeSave();
}
// Save version 3: the story grew from 9 to 18 levels. Anyone who beat Lighthouse Point carries on
// into act two, and the old 9-level full-run record is kept apart from the new 18-level one.
if (save.version < 3) {
  if (save.best[8] !== undefined) save.unlocked = Math.max(save.unlocked, 10);
  if (save.bestRun) { save.bestRunAct1 = save.bestRun; delete save.bestRun; }
  save.version = 3;
  writeSave();
}
// The Boatyard: Embers, owned boats, upgrades and paints live inside the save.
const yard = (save.boatyard = Object.assign(defaultBoatyard(), save.boatyard || {}));
if (!yard.boats[yard.equipped]) yard.equipped = 'skiff';
const equippedStats = () => boatStats(yard.equipped, yard.boats[yard.equipped]);
// Every level is played with the equipped boat's stats.
const newGame = (def, i) => new Game(def, i, equippedStats());
game = newGame(LEVELS[0], 0);
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage blocked: progress just isn't kept */ }
}
// Called when a level is cleared. Returns true if it was a new best time.
// ---------- Ghosts ----------
// While you play a story level or the Daily Voyage, the boat's position is recorded ten times a
// second. A new best time keeps that recording, and next time a pale ghost boat replays it.
const GHOST_STEP = 0.1;
let ghostRec = null;
function ghostKey() {
  if (voyage) return voyage.kind === 'daily' ? 'daily' : null;
  return customDef ? null : `L${levelIndex}`;
}
function recordGhost() {
  if (!ghostRec || ghostRec.game !== game) ghostRec = { game, data: [] };
  const b = game.boat;
  const r = (v) => Math.round(v * 100) / 100;
  while (ghostRec.data.length / 3 <= Math.floor(game.time / GHOST_STEP)) ghostRec.data.push(r(b.x), r(b.z), r(b.angle));
}
function keepGhost() {
  const key = ghostKey();
  if (!key || !ghostRec || ghostRec.game !== game) return;
  save.ghosts = save.ghosts || {};
  save.ghosts[key] = { date: voyage ? voyage.date : undefined, data: ghostRec.data };
  writeSave();
}
// The ghost to show for what's being played now (today's only, for the Daily Voyage).
function currentGhost() {
  const key = settings.ghost && ghostKey();
  const g = key && save.ghosts && save.ghosts[key];
  if (!g || (key === 'daily' && g.date !== voyage.date)) return null;
  return g.data;
}

function recordClear(i, seconds) {
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
  const old = save.best[i];
  const isBest = old === undefined || seconds < old;
  if (isBest) save.best[i] = seconds;
  writeSave();
  return isBest;
}
let lastClear = { time: 0, best: false };
// A full run: playing every level in order from level 1 (retries count towards the time).
let run = { valid: false, time: 0 };
let fireworkTimer = 0;

// ---------- Settings (saved separately from progress) ----------
const SETTINGS_KEY = 'lanternDrift.settings.v1';
const settings = {
  bloom: true, reflections: true, rtShadows: true, fog: true, resolution: 'auto', fpsCap: 'vsync',
  shake: true, rain: true, flashes: true, autoQuality: true, sound: 8, music: 6, fps: false, minimap: true, ghost: true,
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* defaults */ }
function applySettings() {
  renderer.settings.bloom = settings.bloom;
  renderer.settings.shake = settings.shake;
  renderer.settings.rain = settings.rain;
  renderer.settings.reflections = settings.reflections;
  renderer.settings.flashes = settings.flashes;
  renderer.settings.rtShadows = settings.rtShadows;
  renderer.settings.fog = settings.fog;
  renderer.settings.resolution = settings.resolution;
  if (!settings.autoQuality) renderer.autoLevel = 0;
  sound.setVolume('sound', settings.sound / 10);
  sound.setVolume('music', settings.music / 10);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* not saved */ }
  if (loopReady) startFreeLoop(); // a new frame-rate limit may need the free-running loop
}
let loopReady = false; // set once the main loop below exists
// Frame-rate caps. Browsers show at most one frame per screen refresh, so caps above the screen's
// rate (and "uncapped") run the game loop faster than the screen: smoother input, same picture rate.
const FPS_CAPS = ['vsync', 30, 60, 120, 144, 240, 'uncapped'];
const RESOLUTIONS = ['auto', 'native', 1080, 1440, 2160];
const choiceName = {
  vsync: 'Match screen', uncapped: 'Uncapped', auto: 'Auto', native: 'Native',
  1080: '1080p', 1440: '1440p', 2160: '4K (2160p)', 30: '30', 60: '60', 120: '120', 144: '144', 240: '240',
};
const SETTING_ROWS = [
  { key: 'resolution', label: 'Resolution', type: 'choice', options: RESOLUTIONS },
  { key: 'fpsCap', label: 'Frame rate limit', type: 'choice', options: FPS_CAPS },
  { key: 'rtShadows', label: 'Ray-traced shadows', type: 'bool' },
  { key: 'fog', label: 'Volumetric light (mist)', type: 'bool' },
  { key: 'bloom', label: 'Glow and colour effects', type: 'bool' },
  { key: 'reflections', label: 'Water reflections', type: 'bool' },
  { key: 'shake', label: 'Screen shake', type: 'bool' },
  { key: 'flashes', label: 'Flashing effects', type: 'bool' },
  { key: 'autoQuality', label: 'Auto quality (if slow)', type: 'bool' },
  { key: 'rain', label: 'Weather (rain, snow, fog)', type: 'bool' },
  { key: 'sound', label: 'Sound volume', type: 'level' },
  { key: 'music', label: 'Music volume', type: 'level' },
  { key: 'minimap', label: 'Minimap', type: 'bool' },
  { key: 'ghost', label: 'Ghost of your best run', type: 'bool' },
  { key: 'fps', label: 'Show frame rate', type: 'bool' },
  { key: 'back', label: 'Back', type: 'back' },
];
let settingsRow = 0;
let settingsFrom = 'title';
function changeSetting(row, dir) {
  renderer.autoLevel = 0; // the player chose: start auto quality over from full
  if (row.type === 'bool') settings[row.key] = !settings[row.key];
  else if (row.type === 'level') settings[row.key] = Math.max(0, Math.min(10, settings[row.key] + dir));
  else if (row.type === 'choice') {
    const i = Math.max(0, row.options.indexOf(settings[row.key]));
    settings[row.key] = row.options[(i + dir + row.options.length) % row.options.length];
  }
  applySettings();
  sound.play('oil');
  showScreen('settings');
}
function closeSettings() {
  state = settingsFrom;
  showScreen(state);
}

// ---------- First-time tips (level 1 only, each shown once ever) ----------
save.tips = save.tips || {};
function tip(id, text, condition) {
  if (save.tips[id] || !condition) return;
  save.tips[id] = true;
  writeSave();
  say(text, 4.5);
}
function checkTips() {
  if (messageTimer > 1) return;
  const b = game.boat;
  // First sight of each newer feature, in any level or mode (each tip shows once ever).
  const near = (list, r) => list.some((p) => !p.taken && Math.hypot(p.x - b.x, p.z - b.z) < r);
  const touchUI = !touchEl.classList.contains('hidden');
  tip('whirl', 'A whirlpool! It pulls you in. Skim the edge, and lure shadows into the middle', near(game.whirlpools, 9));
  tip('wisp', 'A wisp: small and quick, but it steals less oil', near(game.creatures.filter((c) => c.kind === 'wisp'), 10));
  tip('brute', 'A brute! The first flare only staggers it. Hit it with a second', near(game.creatures.filter((c) => c.kind === 'brute'), 11));
  tip('shard', 'An ember shard: optional treasure worth Embers', near(game.shards, 7));
  tip('dash', touchUI ? 'Tap » to dash: a burst of speed for a little oil' : 'Press Shift to dash: a burst of speed for a little oil',
    (levelIndex >= 1 || voyage) && game.time > 6);
  if (levelIndex !== 0 || customDef || voyage) return;
  const speed = Math.hypot(b.vx, b.vz);
  const nearest = Math.min(99, ...game.creatures.map((c) => Math.hypot(c.x - b.x, c.z - b.z)));
  tip('row', 'Hold W or \u2191 to row forward, A / D to turn', game.time > 4 && speed < 0.5);
  tip('shadow', 'A shadow! Press Space to fire a flare and scare it off', nearest < 9);
  tip('oil', 'Oil drains as you sail. Grab the glowing oil cans', game.oil < 75);
  tip('buoy', 'Lit buoys are safe zones: shadows stay away from them', game.buoysLit === 1);
}

function earn(n) {
  yard.embers += n;
  writeSave();
  return n;
}
// ---------- Achievements ----------
// A small toast slides in at the top when one unlocks; they queue if several come at once.
const toastEl = document.createElement('div');
toastEl.id = 'toast';
document.body.appendChild(toastEl);
const toastQueue = [];
let toastBusy = false;
function showToast() {
  if (toastBusy || !toastQueue.length) return;
  toastBusy = true;
  const a = toastQueue.shift();
  toastEl.innerHTML = `<b>\u{1F3C6} ${a.name}</b><span>${a.desc}</span><em>+${a.embers} \u2726</em>`;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastBusy = false; showToast(); }, 400);
  }, 3200);
}
const FREE_PAINTS = defaultBoatyard().paints.length;
const awards = new Achievements(save, (a) => {
  earn(a.embers);
  sound.play('allBuoys');
  toastQueue.push(a);
  showToast();
});
let playTimer = 0;

const emberLine = () => (lastClear.embers ? `<p class="earned">+${lastClear.embers} \u2726 Embers</p>` : '');

function formatTime(t) {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------- HUD ----------
hudEl.innerHTML = `
  <span class="level"></span>
  <span class="timer"></span>
  <span class="wind hidden" title="Wind">↑</span>
  <button class="pause-btn" aria-label="Pause">II</button>
  <button class="photo-btn" aria-label="Photo mode" title="Photo mode (C)">\u{1F4F7}</button>
  <span class="oil-label">Oil</span><span class="oil"><i></i></span>
  <span class="buoys"></span>
  <span class="hint">WASD / arrows steer · Space flare · Shift dash · C photo · P pause</span>
  <span class="fps hidden"></span>
  <div class="msg"></div>
  <div class="flash"></div>`;
const hud = {
  level: hudEl.querySelector('.level'),
  timer: hudEl.querySelector('.timer'),
  wind: hudEl.querySelector('.wind'),
  oil: hudEl.querySelector('.oil > i'),
  buoys: hudEl.querySelector('.buoys'),
  msg: hudEl.querySelector('.msg'),
  flash: hudEl.querySelector('.flash'),
  fps: hudEl.querySelector('.fps'),
};
let fpsFrames = 0, fpsTime = 0;

const minimap = new Minimap(hudEl);
function updateHud(dt) {
  minimap.canvas.classList.toggle('hidden', !settings.minimap);
  if (settings.minimap && state === 'playing') minimap.draw(game, time);
  hudEl.classList.toggle('hidden', state === 'title' || state === 'editor' || state === 'shop' || state === 'photo' || state === 'awards' || (state === 'settings' && settingsFrom === 'title'));
  hud.level.textContent = voyage
    ? (voyage.kind === 'daily' ? game.def.name : `Voyage ${voyage.depth + 1}: ${game.def.name}`)
    : customDef ? game.def.name : `Level ${levelIndex + 1}: ${game.def.name}`;
  hud.timer.textContent = formatTime(game.time);
  // Wind arrow on storm levels: points where the wind blows (screen up = -z), sized by strength.
  hud.wind.classList.toggle('hidden', !game.storm);
  if (game.storm) {
    const w = game.wind;
    const deg = (Math.atan2(w.x, -w.z) * 180) / Math.PI;
    const s = 0.8 + Math.hypot(w.x, w.z) * 0.35;
    hud.wind.style.transform = `translateX(-50%) rotate(${deg}deg) scale(${s})`;
  }
  const pct = Math.max(0, game.oilPct);
  hud.oil.style.width = `${pct}%`;
  hud.oil.classList.toggle('low', pct < 25);
  const lit = game.buoysLit;
  hud.buoys.textContent = game.lighthouseActive
    ? 'Lighthouse awake: sail to it!'
    : `Buoys lit: ${lit} / ${game.buoys.length}`;
  if (game.shards.length) hud.buoys.textContent += ` · ✦ ${game.shardsTaken} / ${game.shards.length}`;
  messageTimer = Math.max(0, messageTimer - dt);
  hud.msg.textContent = messageTimer > 0 ? message : '';
  hud.msg.style.opacity = Math.min(1, messageTimer * 2);
  hud.fps.classList.toggle('hidden', !settings.fps);
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    hud.fps.textContent = `${Math.round(fpsFrames / fpsTime)} fps`;
    fpsFrames = 0;
    fpsTime = 0;
  }
  hud.flash.style.opacity = renderer.postActive || !settings.flashes ? 0 : game.hitFlash * 1.5; // the post pass draws its own hit effect
}

function say(text, seconds = 2.5) {
  message = text;
  messageTimer = seconds;
}

// ---------- Screens ----------
const SCREENS = {
  title: () => `
    <h1>Lantern Drift</h1>
    <p class="sub">The town has flooded and the lights have gone out.<br>
    Keep your lantern burning, light every buoy, and wake the lighthouse.</p>
    <ul class="how">
      <li class="keys-only"><b>WASD / arrow keys</b> steer the boat</li>
      <li class="keys-only"><b>Space</b> fires a flare that scatters shadows · <b>Shift</b> dashes (both cost oil)</li>
      <li class="touch-only"><b>◀ ▶</b> steer, <b>▲</b> rows forward</li>
      <li class="touch-only"><b>✦</b> fires a flare that scatters shadows · <b>»</b> dashes (both cost oil)</li>
      <li>Collect <b>oil cans</b>; your light shrinks as oil runs low</li>
      <li>Lit <b>buoys</b> are safe zones that shadows won't enter</li>
    </ul>
    <p class="go">Press Enter or tap to start</p>
    ${levelList()}
    <p class="modes"><span data-action="daily"><b>D</b> Daily Voyage${dailyLine()}</span>
      <span data-action="endless"><b>N</b> Endless${save.endlessBest ? ` \u00b7 best: voyage ${save.endlessBest}` : ''}</span></p>
    <p class="embers-line" data-action="shop">\u2726 ${yard.embers.toLocaleString()} Embers \u00b7 <b>${boatById(yard.equipped).name}</b> \u00b7 <u>B Boatyard</u></p>
    <p class="small"><span data-action="awards">A achievements ${awards.count}/${ACHIEVEMENTS.length}</span> \u00b7 <span data-action="editor">E level editor</span> \u00b7 <span data-action="settings">O settings</span> \u00b7 M mute</p>`,
  levelClear: () => `
    <h1>${levelIndex === 8 ? 'Act I complete' : 'Harbour reached'}</h1>
    <p class="sub">${game.def.name} is safe. Oil left: ${Math.round(game.oil)}</p>
    ${game.def.story ? `<p class="story">${game.def.story}</p>` : ''}
    <p class="sub">Time ${formatTime(lastClear.time)} · ${lastClear.best ? '<b class="best">New best!</b>' : `Best ${formatTime(save.best[levelIndex])}`}</p>
    ${emberLine()}
    <p class="go">Press Enter for level ${levelIndex + 2}</p>
    <p class="small"><span data-action="back">Esc back to the title</span></p>`,
  gameOver: () => `
    <h1>Your lantern went out</h1>
    <p class="sub">The shadows close in around the little boat.</p>
    ${emberLine()}
    <p class="go">Press Enter to try again</p>
    <p class="small"><span data-action="back">Esc back to the ${customDef ? 'editor' : 'title'}</span></p>`,
  customClear: () => `
    <h1>You beat your level!</h1>
    <p class="sub">Time ${formatTime(lastClear.time)} \u00b7 oil left ${Math.round(game.oil)}</p>
    ${emberLine()}
    <p class="go">Press Enter to go back to the editor</p>
    <p class="small">Share it from the editor with "Share code"</p>`,
  won: () => `
    <h1>Both lights burn</h1>
    <p class="sub">You brought the old keeper's lantern home. The green light is gold again, and every lighthouse shines. Thanks for playing!</p>
    <p class="sub">Last harbour in ${formatTime(lastClear.time)}${lastClear.best ? ' · <b class="best">New best!</b>' : ''}</p>
    ${emberLine()}
    ${run.valid ? `<p class="sub">Full run: <b>${formatTime(run.time)}</b>${run.best ? ' · <b class="best">New best run!</b>' : save.bestRun ? ` · best ${formatTime(save.bestRun)}` : ''}</p>` : ''}
    <div class="credits"><div class="roll">
      <p><b>Lantern Drift</b></p>
      <p>A game for Hack Club Mipmap</p>
      <p>Directed by<br><b>lazyboiforever12</b></p>
      <p>Built with<br><b>Claude Code</b></p>
      <p>Engine<br><b>none</b>: raw WebGL2,<br>hand-written shaders and maths</p>
      <p>Music and sound<br>generated live with Web Audio</p>
      <p>Levels<br>${LEVELS.map((d) => d.name).join('<br>')}</p>
      <p>Thanks for playing</p>
    </div></div>
    <p class="go">Press Enter to return to the title</p>`,
  voyageClear: () => `
    <h1>Voyage ${voyage.depth + 1} cleared</h1>
    <p class="sub">${game.def.name} \u00b7 time ${formatTime(lastClear.time)} \u00b7 oil left ${Math.round(game.oil)}</p>
    ${emberLine()}
    <p class="sub">The next harbour is further out, and the shadows are hungrier. Choose a blessing for the rest of the run:</p>
    <div class="blessings">${voyage.offer.map((b, i) => `<button data-bless="${i}" class="${i === voyage.pick ? 'sel' : ''}">
      <span class="ico">${b.icon}</span><b>${i + 1}. ${b.name}</b><small>${b.desc}</small></button>`).join('')}</div>
    ${blessingList()}
    <p class="go">Press 1, 2 or 3 (or Enter) to sail on</p>
    <p class="small"><span data-action="back">Esc ends the run</span></p>`,
  voyageOver: () => `
    <h1>The voyage ends</h1>
    <p class="sub">Your lantern went out on voyage ${voyage.depth + 1}. You cleared <b>${voyage.depth}</b>.</p>
    ${blessingList()}
    <p class="sub">${lastClear.newBest ? '<b class="best">New best run!</b>' : `Best run: ${save.endlessBest || 0} voyage${save.endlessBest === 1 ? '' : 's'}`}</p>
    ${emberLine()}
    <p class="go">Press Enter for a new run</p>
    <p class="small"><span data-action="share">S copy your result to share</span> \u00b7 <span data-action="back">Esc back to the title</span></p>`,
  dailyClear: () => `
    <h1>Daily Voyage complete</h1>
    <p class="sub">${game.def.name} \u00b7 ${formatTime(lastClear.time)} ${lastClear.best ? '\u00b7 <b class="best">Your best today!</b>' : `\u00b7 best ${formatTime(save.daily[voyage.date])}`}</p>
    <p class="sub">Streak: <b>${save.dailyStreak} day${save.dailyStreak === 1 ? '' : 's'}</b> \u2014 a new voyage appears at midnight</p>
    ${emberLine()}
    <p class="go">Press Enter to sail it again</p>
    <p class="small"><span data-action="share">S copy your result to share</span> \u00b7 <span data-action="back">Esc back to the title</span></p>`,
  awards: () => `
    <h1>Achievements</h1>
    <p class="sub">${awards.count} of ${ACHIEVEMENTS.length} unlocked \u00b7 each one pays Embers</p>
    ${statsLine()}
    <ul class="awards">${ACHIEVEMENTS.map((a) => `<li class="${awards.has(a.id) ? 'got' : ''}">
      <b>${awards.has(a.id) ? '\u{1F3C6}' : '\u{1F512}'} ${a.name}</b><span>${a.desc}</span><em>${a.embers} \u2726</em></li>`).join('')}</ul>
    <p class="small">Esc or Enter to go back</p>`,
  photo: () => `<p class="photo-hint">\u{1F4F7} Photo mode \u00b7 drag or WASD to orbit \u00b7 scroll or Q / E to zoom \u00b7 F9 saves a picture \u00b7 C or Esc to go back</p>`,
  paused: () => `
    <h1>Paused</h1>
    <p class="sub">${hud.level.textContent} \u00b7 ${formatTime(game.time)} \u00b7 oil ${Math.round(game.oilPct)}%</p>
    ${blessingList()}
    <div class="menu">
      <button data-action="resume"><b>P</b> Carry on</button>
      <button data-action="restart"><b>R</b> Restart</button>
      <button data-action="settings"><b>O</b> Settings</button>
      <button data-action="quit"><b>Q</b> ${customDef ? 'Back to the editor' : 'Quit to the title'}</button>
    </div>`,
  settings: () => `
    <h1>Settings</h1>
    <ul class="settings">${SETTING_ROWS.map((row, i) => {
      let value = '';
      if (row.type === 'bool') value = settings[row.key] ? 'On' : 'Off';
      if (row.type === 'level') value = `${'\u25ae'.repeat(settings[row.key])}${'\u25af'.repeat(10 - settings[row.key])}`;
      if (row.type === 'choice') value = `\u2039 ${choiceName[settings[row.key]] || settings[row.key]} \u203a`;
      return `<li class="${i === settingsRow ? 'sel' : ''}" data-row="${i}"><span>${row.label}</span><b>${value}</b></li>`;
    }).join('')}</ul>
    <p class="small">${settingsNote()}</p>
    <p class="small">\u2191 \u2193 choose \u00b7 \u2190 \u2192 or Enter change \u00b7 Esc back</p>`,
};

// Level select on the title screen, once a level beyond the first is unlocked.
// The story is told in two acts of nine levels. Act two stays a mystery until act one is beaten.
const ACTS = [{ name: 'Act I · The Drowned Town', from: 0 }, { name: 'Act II · The Green Light', from: 9 }];
function levelList() {
  if (save.unlocked < 2) return '';
  const item = (def, i) => {
    const locked = i >= save.unlocked;
    const best = save.best[i] !== undefined ? ` · best ${formatTime(save.best[i])}` : '';
    const total = def.map.join('').split('e').length - 1;
    const found = (save.shards && save.shards[i]) || 0;
    const shards = total && save.best[i] !== undefined ? ` <span class="${found === total ? 'all' : ''}">✦ ${found}/${total}</span>` : '';
    return `<li class="${locked ? 'locked' : ''}" data-level="${i}"><b>${i + 1}</b> ${locked ? '???' : def.name + best + shards}</li>`;
  };
  const acts = ACTS.map((act, a) => {
    const to = a + 1 < ACTS.length ? ACTS[a + 1].from : LEVELS.length;
    const items = LEVELS.slice(act.from, to).map((def, k) => item(def, act.from + k)).join('');
    const hidden = save.unlocked <= act.from;
    return `<div class="act${hidden ? ' sealed' : ''}"><p class="act-name">${hidden ? `${act.name.split(' · ')[0]} · ???` : act.name}</p><ol class="levels">${items}</ol></div>`;
  }).join('');
  const keys = save.unlocked > 9 ? 'press 1–9, or Shift + 1–9 for act II' : 'press a number';
  return `<p class="pick"><span class="key-hint">Or ${keys} to pick a level</span><span class="tap-hint">Or tap a level to play it</span></p><div class="acts">${acts}</div>`;
}

function showScreen(name) {
  screenEl.dataset.screen = name || '';
  if (!name) {
    screenEl.classList.add('hidden');
    return;
  }
  screenEl.innerHTML = SCREENS[name]();
  screenEl.classList.remove('hidden');
}

function dailyLine() {
  const best = save.daily && save.daily[todayKey()];
  const streak = save.dailyStreak && save.dailyLast && daysBetween(save.dailyLast, todayKey()) <= 1 ? save.dailyStreak : 0;
  return `${best !== undefined ? ` \u00b7 today ${formatTime(best)}` : ' \u00b7 new today'}${streak ? ` \u00b7 \u{1F525} ${streak}` : ''}`;
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// Generated voyages. Endless: each clear builds a harder one, until your lantern goes out.
function startVoyage(kind) {
  customDef = null;
  run.valid = false;
  if (kind === 'daily') {
    const def = dailyVoyage();
    voyage = { kind, depth: 0, seed: def.seed, date: def.daily };
    playVoyage(def);
  } else {
    voyage = { kind, depth: 0, seed: (Math.random() * 2 ** 31) >>> 0, blessings: [] };
    playVoyage(generateVoyage(voyage.seed, 0));
  }
}
// Blessings collected so far in this Endless run, shown as a row of icons.
function blessingList() {
  if (!voyage || !voyage.blessings || !voyage.blessings.length) return '';
  return `<p class="small blessed">Blessings: ${voyage.blessings.map((id) => {
    const b = blessingById(id);
    return `<span title="${b.name}: ${b.desc}">${b.icon}</span>`;
  }).join(' ')}</p>`;
}
function pickBlessing(i) {
  voyage.blessings.push(voyage.offer[i].id);
  sound.play('buoy');
  nextVoyage();
}

function playVoyage(def) {
  editor.close();
  // Endless runs use the equipped boat plus every blessing picked so far.
  game = new Game(def, 0, applyBlessings(equippedStats(), (voyage && voyage.blessings) || []));
  state = 'playing';
  showScreen(null);
  say(def.tip || `Light all ${game.buoys.length} buoys, then sail to the lighthouse`, def.tip ? 4 : 3);
}
function nextVoyage() {
  voyage.depth++;
  playVoyage(generateVoyage((voyage.seed + voyage.depth * 104729) >>> 0, voyage.depth));
}
// Called when a generated voyage ends. Sets lastClear and returns the screen to show.
function finishVoyage(won) {
  if (voyage.kind === 'endless') {
    if (!won) {
      const newBest = voyage.depth > (save.endlessBest || 0);
      if (newBest) save.endlessBest = voyage.depth;
      lastClear = { time: game.time, newBest, embers: earn(4 * game.buoysLit + 10 * voyage.depth) };
      return 'voyageOver';
    }
    lastClear = { time: game.time, embers: earn(20 + 6 * voyage.depth + Math.round(game.oilPct / 5)) };
    voyage.offer = rollBlessings();
    voyage.pick = 0;
    // "Reach voyage N": clearing this one takes you to voyage depth + 2.
    awards.cleared({ kind: 'endless', voyage: voyage.depth + 2, time: game.time, oilPct: game.oilPct, hits: game.hitsTaken || 0 });
    return 'voyageClear';
  }
  if (!won) {
    lastClear = { time: game.time, embers: 0 };
    return 'gameOver';
  }
  // Daily: best time for today, a streak for clearing on consecutive days, and Embers once a day.
  save.daily = save.daily || {};
  const today = voyage.date;
  const old = save.daily[today];
  const best = old === undefined || game.time < old;
  if (best) {
    save.daily[today] = game.time;
    keepGhost();
  }
  let embers = 0;
  if (save.dailyLast !== today) {
    save.dailyStreak = save.dailyLast && daysBetween(save.dailyLast, today) === 1 ? (save.dailyStreak || 0) + 1 : 1;
    save.dailyLast = today;
    embers = 60 + 10 * Math.min(9, save.dailyStreak - 1);
  }
  lastClear = { time: game.time, best, embers: embers ? earn(embers) : 0 };
  awards.cleared({ kind: 'daily', streak: save.dailyStreak, time: game.time, oilPct: game.oilPct, hits: game.hitsTaken || 0 });
  writeSave();
  return 'dailyClear';
}

// Retry whatever is being played: a built-in level, a generated voyage, or one from the editor.
function restart() {
  if (voyage) playVoyage(game.def);
  else if (customDef) startCustom(customDef);
  else startLevel(levelIndex);
}

function startCustom(def) {
  voyage = null;
  customDef = def;
  run.valid = false;
  game = newGame(def, 0);
  state = 'playing';
  editor.close();
  showScreen(null);
  say(def.tip || `${def.name}: ${game.buoys.length > 1 ? `light all ${game.buoys.length} buoys` : 'light the buoy'}`, def.tip ? 4 : 3);
}

function openEditor(rows) {
  customDef = null;
  voyage = null;
  state = 'editor';
  showScreen(null);
  editor.open(rows);
}

// Boat in the renderer: the equipped one normally, or whatever is selected in the Boatyard.
function showBoat(id) {
  const boat = boatById(id);
  const owned = yard.boats[id] || boat.paint || { hull: 'oak', trim: 'tar' };
  renderer.setBoat(boat, boatPaint(owned), boatStats(id, owned));
}

// The Boatyard shows the boat on calm open water in level 1, without shadows.
function openShop() {
  state = 'shop';
  showScreen(null);
  game = newGame(LEVELS[0], 0);
  game.creatures.length = 0;
  game.boat.x = 20; game.boat.z = 13;
  renderer.showcase = true;
  shop.open();
}

const shop = createShop({
  yard,
  onSave: () => { awards.boatyard(yard, FREE_PAINTS); writeSave(); },
  onPreview: (id) => showBoat(id),
  onClose: () => { shop.close(); renderer.showcase = false; showBoat(yard.equipped); toTitle(); },
  onSound: (name) => sound.play(name),
});

const editor = createEditor({
  onPlay: (def) => startCustom(def),
  onClose: () => { editor.close(); toTitle(); },
});

function startLevel(i) {
  customDef = null;
  voyage = null;
  if (state === 'title' || state === 'won') run = { valid: i === 0, time: 0 }; // only a run from level 1 counts
  else if (state !== 'levelClear') run.time += game.time;                    // retries and restarts cost time
  levelIndex = i;
  game = newGame(LEVELS[i], i);
  state = 'playing';
  showScreen(null);
  say(game.def.tip || `Light all ${game.buoys.length} buoys to wake the lighthouse`, game.def.tip ? 5 : 4);
}

function toTitle() {
  customDef = null;
  voyage = null;
  editor.close();
  state = 'title';
  levelIndex = 0;
  startDemo();
  showScreen('title');
}

// Lifetime totals for the achievements screen.
function statsLine() {
  const st = save.stats || {};
  const mins = Math.floor((st.playTime || 0) / 60);
  const items = [
    ['Sailed', mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`],
    ['Buoys lit', st.buoys || 0], ['Oil cans', st.oils || 0], ['Flares', st.flares || 0], ['Shards', st.shards || 0],
    ['Best Endless', save.endlessBest ? `voyage ${save.endlessBest + 1}` : '—'],
    ['Daily streak', save.dailyStreak || 0], ['Boats owned', Object.keys(yard.boats).length],
  ];
  return `<p class="stats-line">${items.map(([k, v]) => `<span><small>${k}</small><b>${v}</b></span>`).join('')}</p>`;
}

// ---------- Sharing a result ----------
// A short, spoiler-free summary (like a word-game result) with a link back to the game.
async function shareResult() {
  const url = `${location.origin}${location.pathname}`;
  let text;
  if (voyage && voyage.kind === 'daily') {
    text = `Lantern Drift \u00b7 Daily Voyage ${voyage.date}\n`
      + `\u23F1 ${formatTime(lastClear.time)} \u00b7 \u{1F6E2} oil ${Math.round(game.oilPct)}%`
      + `${game.shards.length ? ` \u00b7 \u2726 ${game.shardsTaken}/${game.shards.length}` : ''}`
      + `${save.dailyStreak > 1 ? ` \u00b7 \u{1F525} ${save.dailyStreak} days` : ''}\n${url}`;
  } else if (voyage) {
    text = `Lantern Drift \u00b7 Endless: my lantern lasted to voyage ${voyage.depth + 1} `
      + `(${'\u{1F7E8}'.repeat(Math.min(voyage.depth, 15))}\u2B1B)\n${url}`;
  } else return;
  try {
    await navigator.clipboard.writeText(text);
    say('Result copied! Paste it anywhere to share', 2.5);
  } catch {
    prompt('Copy your result:', text);
  }
}

// ---------- Photo mode ----------
// Freezes the game (the water and particles keep moving) and hands the camera to the player.
const photoCam = { yaw: 0, pitch: 0.6, dist: 9 };
function enterPhoto() {
  state = 'photo';
  Object.assign(photoCam, { yaw: 0, pitch: 0.6, dist: 9 });
  renderer.photo = photoCam;
  showScreen('photo');
}
function exitPhoto() {
  state = 'playing';
  renderer.photo = null;
  showScreen(null);
}
function updatePhoto(dt) {
  const turn = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  const tilt = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0);
  const zoom = (keys.has('KeyQ') ? -1 : 0) + (keys.has('KeyE') ? 1 : 0);
  photoCam.yaw += turn * dt * 1.4;
  photoCam.pitch = Math.max(0.08, Math.min(1.45, photoCam.pitch + tilt * dt * 0.9));
  photoCam.dist = Math.max(3, Math.min(30, photoCam.dist * (1 + zoom * dt * 1.2)));
}
let photoDrag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'photo') return;
  photoDrag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!photoDrag) return;
  photoCam.yaw -= (e.clientX - photoDrag.x) * 0.008;
  photoCam.pitch = Math.max(0.08, Math.min(1.45, photoCam.pitch + (e.clientY - photoDrag.y) * 0.006));
  photoDrag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => { photoDrag = null; });
canvas.addEventListener('wheel', (e) => {
  if (state !== 'photo') return;
  e.preventDefault();
  photoCam.dist = Math.max(3, Math.min(30, photoCam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
}, { passive: false });

// ---------- Title demo ----------
// Behind the title menu the autopilot sails the story levels one after another, with a slow
// orbiting camera. It's only a show: no sound, Embers, achievements or saved progress.
let demo = null;
let demoLevel = 0;
function startDemo() {
  demoLevel = (demoLevel + 1) % LEVELS.length;
  game = newGame(LEVELS[demoLevel], demoLevel);
  demo = { game, think: createAutopilot(game), input: null, timer: 0 };
}
const inMenus = () => state === 'title' || state === 'awards' || (state === 'settings' && settingsFrom === 'title');
function updateDemo(dt) {
  if (!demo || demo.game !== game) startDemo();
  demo.timer -= dt;
  if (demo.timer <= 0 || !demo.input) { demo.input = demo.think(); demo.timer = 0.12; }
  if (demo.input.flare) { game.flare(); demo.input.flare = false; }
  game.update(dt, demo.input);
  for (const ev of game.events) renderer.effect(ev, game); // just the particles
  game.events.length = 0;
  if (game.result || game.time > 100) startDemo();
}

// ---------- Input ----------
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, select, textarea')) return; // typing in a form field
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  sound.unlock();
  if (!e.repeat) onPress(e.code, e);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
function pauseForFocusLoss() {
  keys.clear();
  touch.clear();
  if (state === 'playing') {
    state = 'paused';
    showScreen('paused');
  }
}
addEventListener('blur', pauseForFocusLoss);
// Switching tabs or minimising: pause the game and silence the sound until the player comes back
// (game portals test for this). The audio wakes up again on the next key press or tap.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseForFocusLoss();
    sound.suspend();
  } else {
    sound.resumeIfUnlocked();
  }
});
// If the graphics driver resets (laptops can do this after sleep), WebGL loses everything it made.
// Ask the browser to restore the context, then reload: progress is in localStorage, so nothing is lost.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  screenEl.innerHTML = '<h1>Lantern Drift</h1><p>The graphics driver restarted. Reloading… (if nothing happens, refresh the page; your progress is saved)</p>';
  screenEl.classList.remove('hidden');
});
canvas.addEventListener('webglcontextrestored', () => location.reload());

function onPress(code, e) {
  const go = code === 'Enter' || code === 'Space';
  if (code === 'F9') {
    wantScreenshot = true;
    return;
  }
  if (code === 'KeyM' && state !== 'editor') {
    say(sound.toggleMute() ? 'Sound off' : 'Sound on', 1.2);
    return;
  }
  if (code === 'F3') {
    settings.fps = !settings.fps;
    applySettings();
    return;
  }
  if (state === 'editor') {
    editor.key(code, e);
    return;
  }
  if (state === 'shop') {
    shop.key(code);
    return;
  }
  if (code === 'KeyB' && state === 'title') {
    openShop();
    return;
  }
  if ((code === 'KeyD' || code === 'KeyN') && state === 'title') {
    startVoyage(code === 'KeyD' ? 'daily' : 'endless');
    return;
  }
  if (code === 'KeyA' && state === 'title') {
    state = 'awards';
    showScreen('awards');
    return;
  }
  if (code === 'KeyE' && state === 'title') {
    openEditor();
    return;
  }
  if (code === 'KeyO' && (state === 'title' || state === 'paused')) {
    settingsFrom = state;
    settingsRow = 0;
    state = 'settings';
    showScreen('settings');
    return;
  }
  switch (state) {
    case 'settings': {
      const row = SETTING_ROWS[settingsRow];
      if (code === 'ArrowUp' || code === 'KeyW') settingsRow = (settingsRow + SETTING_ROWS.length - 1) % SETTING_ROWS.length;
      else if (code === 'ArrowDown' || code === 'KeyS') settingsRow = (settingsRow + 1) % SETTING_ROWS.length;
      else if (code === 'Escape' || code === 'KeyO' || (go && row.type === 'back')) { closeSettings(); break; }
      else if (code === 'ArrowLeft' || code === 'KeyA') { if (row.type !== 'back') changeSetting(row, -1); break; }
      else if (code === 'ArrowRight' || code === 'KeyD' || go) { if (row.type !== 'back') changeSetting(row, 1); break; }
      else break;
      showScreen('settings');
      break;
    }
    case 'title': {
      let n = code.startsWith('Digit') && code !== 'Digit0' ? Number(code.slice(5)) - 1 : -1;
      if (n >= 0 && e && e.shiftKey) n += 9; // Shift + 1-9: act two
      if (n >= 0 && n < save.unlocked) startLevel(n);
      else if (go) startLevel(0);
      break;
    }
    case 'levelClear':
      if (go) startLevel(levelIndex + 1);
      else if (code === 'Escape') toTitle();
      break;
    case 'awards':
      if (go || code === 'Escape') toTitle();
      break;
    case 'voyageClear': {
      const n = code.startsWith('Digit') ? Number(code.slice(5)) - 1 : -1;
      if (n >= 0 && n < voyage.offer.length) pickBlessing(n);
      else if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') {
        const step = code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1;
        voyage.pick = (voyage.pick + step + voyage.offer.length) % voyage.offer.length;
        showScreen(state);
      } else if (go) pickBlessing(voyage.pick);
      else if (code === 'Escape') toTitle();
      break;
    }
    case 'voyageOver':
      if (code === 'KeyS') shareResult();
      else if (go) startVoyage('endless');
      else if (code === 'Escape') toTitle();
      break;
    case 'dailyClear':
      if (code === 'KeyS') shareResult();
      else if (go) restart();
      else if (code === 'Escape') toTitle();
      break;
    case 'gameOver':
      if (go) restart();
      else if (code === 'Escape') { if (customDef) openEditor(); else toTitle(); }
      break;
    case 'customClear':
      if (go || code === 'Escape') openEditor();
      break;
    case 'won':
      if (go) toTitle();
      break;
    case 'paused':
      if (code === 'KeyP' || code === 'Escape') {
        state = 'playing';
        showScreen(null);
      } else if (code === 'KeyR') restart();
      else if (code === 'KeyQ') { if (customDef) openEditor(); else toTitle(); }
      break;
    case 'photo':
      if (code === 'KeyC' || code === 'Escape' || code === 'KeyP' || code === 'Enter') exitPhoto();
      break;
    case 'playing':
      if (code === 'KeyC') { enterPhoto(); break; }
      if (code === 'ShiftLeft' || code === 'ShiftRight') { game.dash(); break; }
      if (code === 'Space') game.flare();
      else if (code === 'KeyR') restart();
      else if (code === 'KeyP' || code === 'Escape') {
        state = 'paused';
        showScreen('paused');
      }
      break;
  }
}

function readInput(pad) {
  return {
    forward: keys.has('KeyW') || keys.has('ArrowUp') || touch.has('forward') || pad.forward,
    back: keys.has('KeyS') || keys.has('ArrowDown') || pad.back,
    left: keys.has('KeyA') || keys.has('ArrowLeft') || touch.has('left') || pad.left,
    right: keys.has('KeyD') || keys.has('ArrowRight') || touch.has('right') || pad.right,
  };
}

// ---------- Gamepad ----------
// Left stick or d-pad steers, stick up / right trigger rows forward, A fires flares and
// confirms menus, Start pauses, B goes back. Uses the standard gamepad button layout.
const padWasDown = {};
function padPressed(name, down) {
  const fresh = down && !padWasDown[name];
  padWasDown[name] = down;
  return fresh;
}
function readGamepad() {
  const out = { forward: false, back: false, left: false, right: false };
  const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
  const pad = pads.find((p) => p && p.connected);
  if (!pad) return out;
  const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
  out.left = x < -0.35 || btn(14);
  out.right = x > 0.35 || btn(15);
  out.forward = y < -0.35 || btn(12) || btn(7);
  out.back = y > 0.5 || btn(13) || btn(6);
  if (padPressed('a', btn(0))) { sound.unlock(); onPress('Space'); }
  if (padPressed('start', btn(9))) {
    sound.unlock();
    onPress(state === 'playing' || state === 'paused' ? 'KeyP' : 'Enter');
  }
  if (padPressed('b', btn(1))) { if (state === 'playing') game.dash(); else onPress('Escape'); }
  if (padPressed('rb', btn(5)) && state === 'playing') game.dash();
  if (state === 'settings') {
    if (padPressed('up', btn(12) || y < -0.5)) onPress('ArrowUp');
    if (padPressed('down', btn(13) || y > 0.5)) onPress('ArrowDown');
    if (padPressed('left', btn(14) || x < -0.5)) onPress('ArrowLeft');
    if (padPressed('right', btn(15) || x > 0.5)) onPress('ArrowRight');
  }
  if (state === 'voyageClear') {
    // Choose a blessing with the d-pad or stick, then A to sail on.
    if (padPressed('left', btn(14) || x < -0.5)) onPress('ArrowLeft');
    if (padPressed('right', btn(15) || x > 0.5)) onPress('ArrowRight');
  }
  if (state === 'paused') {
    if (padPressed('x', btn(2))) onPress('KeyR');      // X restarts
    if (padPressed('select', btn(8))) onPress('KeyQ'); // Back / Select quits
  }
  if (padPressed('y', btn(3)) && (state === 'title' || state === 'paused')) onPress('KeyO');
  return out;
}

// ---------- Touch ----------
// On-screen buttons, shown once the player touches the screen.
const touch = new Set();
const touchEl = document.createElement('div');
touchEl.id = 'touch';
touchEl.className = 'hidden';
touchEl.innerHTML = `
  <div class="pad left"><button data-k="left" aria-label="Turn left">&#9664;</button><button data-k="right" aria-label="Turn right">&#9654;</button></div>
  <div class="pad right"><button data-k="dash" aria-label="Dash">&raquo;</button><button data-k="flare" aria-label="Flare">&#10022;</button><button data-k="forward" aria-label="Row forward">&#9650;</button></div>`;
document.body.appendChild(touchEl);
for (const b of touchEl.querySelectorAll('button')) {
  const k = b.dataset.k;
  const release = () => { touch.delete(k); b.classList.remove('down'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    sound.unlock();
    b.classList.add('down');
    if (k === 'flare') { if (state === 'playing') game.flare(); }
    else if (k === 'dash') { if (state === 'playing') game.dash(); }
    else touch.add(k);
  });
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
}
addEventListener('touchstart', () => touchEl.classList.remove('hidden'), { once: true, passive: true });
hudEl.querySelector('.photo-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state === 'playing') enterPhoto();
});
hudEl.querySelector('.pause-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state === 'playing') onPress('KeyP');
});
// Tapping or clicking a menu screen works like Enter (or carries on when paused).
screenEl.addEventListener('pointerdown', (e) => {
  sound.unlock();
  const pick = e.target.closest('[data-level]');
  const rowEl = e.target.closest('[data-row]');
  if (e.target.closest('[data-action="shop"]')) {
    openShop();
  } else if (e.target.closest('[data-action="back"]')) {
    onPress('Escape');
  } else if (e.target.closest('[data-action="resume"]')) {
    onPress('KeyP');
  } else if (e.target.closest('[data-action="restart"]')) {
    onPress('KeyR');
  } else if (e.target.closest('[data-action="quit"]')) {
    onPress('KeyQ');
  } else if (state === 'paused' && !e.target.closest('[data-action]')) {
    // Tapping outside the buttons does nothing while paused, so a stray tap can't resume by accident.
  } else if (e.target.closest('[data-bless]')) {
    if (state === 'voyageClear') pickBlessing(Number(e.target.closest('[data-bless]').dataset.bless));
  } else if (e.target.closest('[data-action="share"]')) {
    shareResult();
  } else if (state === 'photo') {
    exitPhoto();
  } else if (e.target.closest('[data-action="awards"]')) {
    onPress('KeyA');
  } else if (e.target.closest('[data-action="daily"]')) {
    startVoyage('daily');
  } else if (e.target.closest('[data-action="endless"]')) {
    startVoyage('endless');
  } else if (e.target.closest('[data-action="editor"]')) {
    openEditor();
  } else if (e.target.closest('[data-action="settings"]')) {
    onPress('KeyO');
  } else if (state === 'settings') {
    if (rowEl) {
      settingsRow = Number(rowEl.dataset.row);
      const row = SETTING_ROWS[settingsRow];
      if (row.type === 'back') closeSettings();
      else changeSetting(row, 1);
    }
  } else if (state === 'title' && pick) {
    if (!pick.classList.contains('locked')) startLevel(Number(pick.dataset.level));
  } else {
    onPress(state === 'paused' ? 'KeyP' : 'Enter');
  }
});

// ---------- Events from the game ----------
function handleEvent(ev) {
  sound.play(ev.type);
  renderer.effect(ev, game);
  if (ev.type === 'buoy') awards.record('buoys');
  if (ev.type === 'oil') awards.record('oils');
  if (ev.type === 'flare') {
    awards.record('flares');
    if (ev.stunned >= 3) awards.unlock('tripleStun');
  }
  if (ev.type === 'hit') game.hitsTaken = (game.hitsTaken || 0) + 1;
  if (ev.type === 'lightning' && ev.stunned) awards.unlock('stormChaser');
  if (ev.type === 'shard') { earn(ev.embers); awards.record('shards'); }
  if (ev.type === 'whirl' && !ev.boat) awards.unlock('drain');
  if (ev.type === 'bruteStun') awards.unlock('bruteStun');
  switch (ev.type) {
    case 'oil': say('+ Oil'); break;
    case 'buoy':
      if (!game.lighthouseActive) say(`Buoy lit (${game.buoysLit} / ${game.buoys.length})`);
      break;
    case 'allBuoys': say('The lighthouse is awake! Sail to it.', 4); break;
    case 'hit': say('A shadow stole some oil!', 1.5); break;
    case 'noFlare': say('Not enough oil for a flare', 1.5); break;
    case 'lightning':
      if (ev.hurt) say('Struck by lightning!', 1.5);
      else if (ev.stunned) say(`Lightning stunned ${ev.stunned} shadow${ev.stunned > 1 ? 's' : ''}!`, 1.5);
      break;
    case 'shard': say(`+${ev.embers} \u2726 Ember shard (${game.shardsTaken} / ${game.shards.length})`, 1.5); break;
    case 'whirl': say(ev.boat ? 'Caught in the whirlpool! Lost some oil' : 'A shadow went down the whirlpool!', 1.5); break;
    case 'buoyOut': say(`A buoy burned out! (${game.buoysLit} / ${game.buoys.length} lit)`, 2); break;
    case 'gates': say('The floodgates are sinking! New waters open up.', 3); awards.unlock('floodgates'); break;
    case 'eclipseWarn': say('The moon is going dark… find a lit buoy!', 2.5); break;
    case 'eclipseEnd': say('The moon is back.', 1.5); awards.unlock('eclipse'); break;
    case 'win': if (!voyage && !customDef && levelIndex === LEVELS.length - 1) awards.unlock('keeper'); break;
  }
}

// ---------- Automatic quality ----------
// If frames stay slow (under ~45 fps) for a few seconds while playing, step the graphics down one
// level at a time: reflections, then bloom, then resolution. Turned off by the "Auto quality" setting.
let slowTime = 0, avgFrame = 1 / 60;
function watchFrameRate(raw) {
  if (state !== 'playing' || !settings.autoQuality || raw > 0.25) return; // ignore tab switches
  avgFrame += (raw - avgFrame) * 0.05;
  // "Slow" means under 45 fps, or well under a lower frame-rate limit the player picked.
  const target = typeof settings.fpsCap === 'number' && settings.fpsCap < 45 ? 1 / (settings.fpsCap * 0.85) : 1 / 45;
  slowTime = avgFrame > target ? slowTime + raw : Math.max(0, slowTime - raw);
  if (slowTime > 3 && renderer.autoLevel < 3) {
    renderer.autoLevel++;
    slowTime = 0;
    avgFrame = 1 / 60;
    say('Lowered graphics quality for smoother play (see Settings)', 3);
  }
}

// ---------- Main loop ----------
// Normally one frame per screen refresh (requestAnimationFrame). A lower frame-rate limit skips
// refreshes on a schedule; a limit above the screen's rate, or "uncapped", switches to a free-running
// loop driven by MessageChannel (it doesn't wait for the screen, so the game updates more often).
let refreshMs = 1000 / 60;   // measured screen refresh interval
let lastRaf = 0;
let nextDue = 0;
let freeLoop = false;
const pump = new MessageChannel();

function runFrame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(raw, 0.05);
  last = now;
  watchFrameRate(raw);
  tick(dt);
}
const capMs = () => (typeof settings.fpsCap === 'number' ? 1000 / settings.fpsCap : 0);
const wantsFreeLoop = () => settings.fpsCap === 'uncapped' || (capMs() > 0 && capMs() < refreshMs * 0.95);

function frame(now) {
  // Keep measuring the screen's refresh rate (a smoothed average of the gaps between refreshes).
  if (lastRaf && now - lastRaf < 100) refreshMs += (now - lastRaf - refreshMs) * 0.05;
  lastRaf = now;
  requestAnimationFrame(frame);
  if (wantsFreeLoop()) {
    startFreeLoop();
    return;
  }
  const cap = capMs();
  if (cap) {
    // Draw on the refresh nearest each due time, so a 60 cap on a 144 Hz screen averages 60.
    if (now < nextDue - refreshMs / 2) return;
    nextDue = Math.max(nextDue + cap, now - cap);
  }
  runFrame(now);
}

function startFreeLoop() {
  if (freeLoop || !wantsFreeLoop()) return;
  freeLoop = true;
  pump.port2.postMessage(0);
}

pump.port1.onmessage = () => {
  if (!wantsFreeLoop()) { freeLoop = false; return; } // back to the normal loop
  const now = performance.now();
  const wait = capMs() - (now - last);
  if (wait <= 0.2 && renderer.gpuReady()) {
    runFrame(now);
    renderer.markFrame();
  }
  // Hidden tab: slow right down. Long waits use a timer so the CPU can rest.
  if (document.hidden) setTimeout(() => pump.port2.postMessage(0), 250);
  else if (wait > 4) setTimeout(() => pump.port2.postMessage(0), wait - 2);
  else pump.port2.postMessage(0);
};

function settingsNote() {
  const hz = Math.round(1000 / refreshMs);
  const [w, h] = renderer.renderSize();
  return `Rendering at ${w}\u00d7${h} \u00b7 your screen refreshes about ${hz} times a second`;
}

// One step of the game: input, rules, drawing and HUD.
function tick(dt) {
  time += dt;
  const pad = readGamepad(); // read every frame so menu buttons work too
  if (state === 'shop') game.boat.angle = time * 0.5; // the preview boat turns slowly
  if (state === 'won') {
    // Fireworks over the last lighthouse while the credits roll.
    fireworkTimer -= dt;
    if (fireworkTimer <= 0) {
      fireworkTimer = 0.5 + Math.random() * 0.7;
      const lh = game.lighthouse;
      renderer.firework(lh.x + (Math.random() - 0.5) * 16, lh.z + (Math.random() - 0.5) * 10);
      sound.play('firework');
    }
  }
  // The weather's sound follows whatever level is on screen (the title demo too).
  const weather = game.def.storm ? 'storm' : game.def.weather || 'rain';
  sound.setWeather(settings.rain && state !== 'editor' && state !== 'shop' ? weather : 'none');
  renderer.ghost = state === 'playing' || state === 'paused' || state === 'photo' ? currentGhost() : null;
  renderer.cinematic = inMenus();
  if (renderer.cinematic) updateDemo(dt);
  if (state === 'photo') updatePhoto(dt);
  if (state === 'playing') {
    playTimer += dt;
    if (playTimer >= 10) { awards.record('playTime', 10); playTimer -= 10; writeSave(); }
    checkTips();
    const b = game.boat;
    const nearest = Math.min(99, ...game.creatures.map((c) => Math.hypot(c.x - b.x, c.z - b.z)));
    sound.tension = Math.max(0, Math.min(1, (10 - nearest) / 8));
    sound.danger = Math.max(0, Math.min(1, (30 - game.oilPct) / 30));
  } else {
    sound.tension = 0;
    sound.danger = 0;
  }
  if (state === 'playing') {
    game.update(dt, readInput(pad));
    recordGhost();
    for (const ev of game.events) handleEvent(ev);
    game.events.length = 0;
    if (game.result && voyage) {
      state = finishVoyage(game.result === 'won');
      showScreen(state);
    } else if (game.result === 'lost') {
      // Even a lost run pays a little for how far you got.
      lastClear = { time: game.time, best: false, embers: earn(4 * game.buoysLit) };
      state = 'gameOver';
      showScreen('gameOver');
    } else if (game.result === 'won' && customDef) {
      lastClear = { time: game.time, best: false, embers: earn(10) };
      awards.cleared({ kind: 'custom', time: game.time, oilPct: game.oilPct, hits: game.hitsTaken || 0 });
      state = 'customClear';
      showScreen(state);
    } else if (game.result === 'won') {
      const first = save.best[levelIndex] === undefined;
      lastClear = { time: game.time, best: recordClear(levelIndex, game.time) };
      if (lastClear.best) keepGhost();
      // The most ember shards found in one clear of this level, for the level list.
      save.shards = save.shards || {};
      save.shards[levelIndex] = Math.max(save.shards[levelIndex] || 0, game.shardsTaken);
      writeSave();
      run.time += game.time;
      // Embers: more for later levels, oil left over, a first clear, and a new best time.
      let embers = 25 + 10 * levelIndex + Math.round(game.oilPct / 4);
      if (first) embers += 40 + 15 * levelIndex;
      else if (lastClear.best) embers += 15;
      if (levelIndex === LEVELS.length - 1 && run.valid) {
        run.best = !save.bestRun || run.time < save.bestRun;
        if (run.best) { save.bestRun = run.time; writeSave(); }
        embers += 150; // full run bonus
      }
      lastClear.embers = earn(embers);
      awards.cleared({
        kind: 'story', levelIndex, time: game.time, oilPct: game.oilPct, hits: game.hitsTaken || 0,
        fullRun: levelIndex === LEVELS.length - 1 && run.valid,
      });
      state = levelIndex === LEVELS.length - 1 ? 'won' : 'levelClear';
      showScreen(state);
    }
  }

  renderer.draw(game, time, dt, { playing: state === 'playing' });
  updateHud(dt);
  if (wantScreenshot) {
    // Read the canvas straight after drawing, before the browser clears it.
    wantScreenshot = false;
    saveScreenshot(canvas.toDataURL('image/png'));
  }
}

// ---------- Screenshots (F9) ----------
// On the local dev server the image is saved into screenshots/; anywhere else it downloads.
let wantScreenshot = false;
async function saveScreenshot(dataUrl) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const res = await fetch('/screenshot', { method: 'POST', body: blob });
      if (res.ok) {
        say(`Saved ${await res.text()}`, 2);
        return;
      }
    } catch { /* fall back to a download */ }
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'lantern-drift.png';
  a.click();
}

// Handy for debugging in the browser console: lanternDrift.game.oil = 100
// lanternDrift.step(2) runs two seconds of game time at once (works even in a background tab).
// Developer tools in the browser console (lanternDrift.step(2), lanternDrift.game.oil = 100, ...).
// Only on the local dev server, or with ?dev in the address, so the public game doesn't hand
// every player cheats. (Saves live in each player's own browser, so this was never a way to
// change anything for anyone else.)
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('dev');
if (DEV) window.lanternDrift = {
  get game() { return game; },
  get state() { return state; },
  startLevel,
  get renderer() { return renderer; },
  editor: () => editor,
  yard,
  openShop,
  save,
  step(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60);
  },
  screenshot() {
    wantScreenshot = true;
    tick(0);
  },
};

loopReady = true;
applySettings();
showBoat(yard.equipped);
startDemo();
showScreen('title');
// A shared level link (#level=CODE) opens straight into the editor with that level.
if (location.hash.startsWith('#level=')) {
  try {
    openEditor(decodeShare(location.hash.slice(7)));
  } catch {
    say('That level link is broken', 3);
  }
}
requestAnimationFrame(frame);
