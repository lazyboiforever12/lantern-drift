// Entry point: input, game states, HUD and the main loop.
import { Renderer } from './render.js';
import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Sound } from './audio.js';

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
let state = 'title'; // title | playing | paused | levelClear | gameOver | won
let levelIndex = 0;
let game = new Game(LEVELS[0], 0);
let time = 0;
let last = performance.now();
let message = '';
let messageTimer = 0;

// ---------- Saved progress (which levels are unlocked, best times) ----------
const SAVE_KEY = 'lanternDrift.save.v1';
function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data && typeof data.unlocked === 'number') return { unlocked: data.unlocked, best: data.best || {} };
  } catch { /* private mode or bad data: start fresh */ }
  return { unlocked: 1, best: {} };
}
const save = loadSave();
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage blocked: progress just isn't kept */ }
}
// Called when a level is cleared. Returns true if it was a new best time.
function recordClear(i, seconds) {
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
  const old = save.best[i];
  const isBest = old === undefined || seconds < old;
  if (isBest) save.best[i] = seconds;
  writeSave();
  return isBest;
}
let lastClear = { time: 0, best: false };

// ---------- Settings (saved separately from progress) ----------
const SETTINGS_KEY = 'lanternDrift.settings.v1';
const settings = { bloom: true, shake: true, rain: true, sound: 8, music: 6, fps: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* defaults */ }
function applySettings() {
  renderer.settings.bloom = settings.bloom;
  renderer.settings.shake = settings.shake;
  renderer.settings.rain = settings.rain;
  sound.setVolume('sound', settings.sound / 10);
  sound.setVolume('music', settings.music / 10);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* not saved */ }
}
const SETTING_ROWS = [
  { key: 'bloom', label: 'Glow and colour effects', type: 'bool' },
  { key: 'shake', label: 'Screen shake', type: 'bool' },
  { key: 'rain', label: 'Rain', type: 'bool' },
  { key: 'sound', label: 'Sound volume', type: 'level' },
  { key: 'music', label: 'Music volume', type: 'level' },
  { key: 'fps', label: 'Show frame rate', type: 'bool' },
  { key: 'back', label: 'Back', type: 'back' },
];
let settingsRow = 0;
let settingsFrom = 'title';
function changeSetting(row, dir) {
  if (row.type === 'bool') settings[row.key] = !settings[row.key];
  else if (row.type === 'level') settings[row.key] = Math.max(0, Math.min(10, settings[row.key] + dir));
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
  if (levelIndex !== 0 || messageTimer > 1) return;
  const b = game.boat;
  const speed = Math.hypot(b.vx, b.vz);
  const nearest = Math.min(99, ...game.creatures.map((c) => Math.hypot(c.x - b.x, c.z - b.z)));
  tip('row', 'Hold W or \u2191 to row forward, A / D to turn', game.time > 4 && speed < 0.5);
  tip('shadow', 'A shadow! Press Space to fire a flare and scare it off', nearest < 9);
  tip('oil', 'Oil drains as you sail. Grab the glowing oil cans', game.oil < 75);
  tip('buoy', 'Lit buoys are safe zones: shadows stay away from them', game.buoysLit === 1);
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------- HUD ----------
hudEl.innerHTML = `
  <span class="level"></span>
  <span class="timer"></span>
  <button class="pause-btn" aria-label="Pause">II</button>
  <span class="oil-label">Oil</span><span class="oil"><i></i></span>
  <span class="buoys"></span>
  <span class="hint">WASD / arrows steer · Space flare · P pause · M mute</span>
  <span class="fps hidden"></span>
  <div class="msg"></div>
  <div class="flash"></div>`;
const hud = {
  level: hudEl.querySelector('.level'),
  timer: hudEl.querySelector('.timer'),
  oil: hudEl.querySelector('.oil > i'),
  buoys: hudEl.querySelector('.buoys'),
  msg: hudEl.querySelector('.msg'),
  flash: hudEl.querySelector('.flash'),
  fps: hudEl.querySelector('.fps'),
};
let fpsFrames = 0, fpsTime = 0;

function updateHud(dt) {
  hudEl.classList.toggle('hidden', state === 'title' || (state === 'settings' && settingsFrom === 'title'));
  hud.level.textContent = `Level ${levelIndex + 1}: ${game.def.name}`;
  hud.timer.textContent = formatTime(game.time);
  const pct = Math.max(0, game.oil);
  hud.oil.style.width = `${pct}%`;
  hud.oil.classList.toggle('low', pct < 25);
  const lit = game.buoysLit;
  hud.buoys.textContent = game.lighthouseActive
    ? 'Lighthouse awake: sail to it!'
    : `Buoys lit: ${lit} / ${game.buoys.length}`;
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
  hud.flash.style.opacity = renderer.postActive ? 0 : game.hitFlash * 1.5; // the post pass draws its own hit effect
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
      <li><b>WASD / arrow keys</b> steer the boat</li>
      <li><b>Space</b> fires a flare that scatters shadows (costs oil)</li>
      <li>Collect <b>oil cans</b>; your light shrinks as oil runs low</li>
      <li>Lit <b>buoys</b> are safe zones that shadows won't enter</li>
    </ul>
    <p class="go">Press Enter or tap to start</p>
    ${levelList()}
    <p class="small" data-action="settings">O settings \u00b7 M mute</p>`,
  levelClear: () => `
    <h1>Harbour reached</h1>
    <p class="sub">${game.def.name} is safe. Oil left: ${Math.round(game.oil)}</p>
    <p class="sub">Time ${formatTime(lastClear.time)} · ${lastClear.best ? '<b class="best">New best!</b>' : `Best ${formatTime(save.best[levelIndex])}`}</p>
    <p class="go">Press Enter for level ${levelIndex + 2}</p>`,
  gameOver: () => `
    <h1>Your lantern went out</h1>
    <p class="sub">The shadows close in around the little boat.</p>
    <p class="go">Press Enter to try again</p>`,
  won: () => `
    <h1>The town is lit</h1>
    <p class="sub">Every lighthouse is shining again. Thanks for playing!</p>
    <p class="sub">Last harbour in ${formatTime(lastClear.time)}${lastClear.best ? ' · <b class="best">New best!</b>' : ''}</p>
    <p class="go">Press Enter to return to the title</p>`,
  paused: () => `
    <h1>Paused</h1>
    <p class="go">Press P or tap to carry on</p>
    <p class="sub">R restart the level \u00b7 Q back to the title</p>
    <p class="small" data-action="settings">O settings</p>`,
  settings: () => `
    <h1>Settings</h1>
    <ul class="settings">${SETTING_ROWS.map((row, i) => {
      let value = '';
      if (row.type === 'bool') value = settings[row.key] ? 'On' : 'Off';
      if (row.type === 'level') value = `${'\u25ae'.repeat(settings[row.key])}${'\u25af'.repeat(10 - settings[row.key])}`;
      return `<li class="${i === settingsRow ? 'sel' : ''}" data-row="${i}"><span>${row.label}</span><b>${value}</b></li>`;
    }).join('')}</ul>
    <p class="small">\u2191 \u2193 choose \u00b7 \u2190 \u2192 or Enter change \u00b7 Esc back</p>`,
};

// Level select on the title screen, once a level beyond the first is unlocked.
function levelList() {
  if (save.unlocked < 2) return '';
  const items = LEVELS.map((def, i) => {
    const locked = i >= save.unlocked;
    const best = save.best[i] !== undefined ? ` · best ${formatTime(save.best[i])}` : '';
    return `<li class="${locked ? 'locked' : ''}" data-level="${i}"><b>${i + 1}</b> ${locked ? '???' : def.name + best}</li>`;
  }).join('');
  return `<p class="pick">Or press a number to pick a level</p><ol class="levels">${items}</ol>`;
}

function showScreen(name) {
  if (!name) {
    screenEl.classList.add('hidden');
    return;
  }
  screenEl.innerHTML = SCREENS[name]();
  screenEl.classList.remove('hidden');
}

function startLevel(i) {
  levelIndex = i;
  game = new Game(LEVELS[i], i);
  state = 'playing';
  showScreen(null);
  say(game.def.tip || `Light all ${game.buoys.length} buoys to wake the lighthouse`, game.def.tip ? 5 : 4);
}

function toTitle() {
  state = 'title';
  levelIndex = 0;
  game = new Game(LEVELS[0], 0);
  showScreen('title');
}

// ---------- Input ----------
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

addEventListener('keydown', (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  sound.unlock();
  if (!e.repeat) onPress(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  touch.clear();
  if (state === 'playing') {
    state = 'paused';
    showScreen('paused');
  }
});

function onPress(code) {
  const go = code === 'Enter' || code === 'Space';
  if (code === 'F9') {
    wantScreenshot = true;
    return;
  }
  if (code === 'KeyM') {
    say(sound.toggleMute() ? 'Sound off' : 'Sound on', 1.2);
    return;
  }
  if (code === 'F3') {
    settings.fps = !settings.fps;
    applySettings();
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
      const n = code.startsWith('Digit') ? Number(code.slice(5)) - 1 : -1;
      if (n >= 0 && n < save.unlocked) startLevel(n);
      else if (go) startLevel(0);
      break;
    }
    case 'levelClear':
      if (go) startLevel(levelIndex + 1);
      else if (code === 'Escape') toTitle();
      break;
    case 'gameOver':
      if (go) startLevel(levelIndex);
      else if (code === 'Escape') toTitle();
      break;
    case 'won':
      if (go) toTitle();
      break;
    case 'paused':
      if (code === 'KeyP' || code === 'Escape') {
        state = 'playing';
        showScreen(null);
      } else if (code === 'KeyR') startLevel(levelIndex);
      else if (code === 'KeyQ') toTitle();
      break;
    case 'playing':
      if (code === 'Space') game.flare();
      else if (code === 'KeyR') startLevel(levelIndex);
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
  if (padPressed('b', btn(1)) && state !== 'playing') onPress('Escape');
  if (state === 'settings') {
    if (padPressed('up', btn(12) || y < -0.5)) onPress('ArrowUp');
    if (padPressed('down', btn(13) || y > 0.5)) onPress('ArrowDown');
    if (padPressed('left', btn(14) || x < -0.5)) onPress('ArrowLeft');
    if (padPressed('right', btn(15) || x > 0.5)) onPress('ArrowRight');
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
  <div class="pad right"><button data-k="flare" aria-label="Flare">&#10022;</button><button data-k="forward" aria-label="Row forward">&#9650;</button></div>`;
document.body.appendChild(touchEl);
for (const b of touchEl.querySelectorAll('button')) {
  const k = b.dataset.k;
  const release = () => { touch.delete(k); b.classList.remove('down'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    sound.unlock();
    b.classList.add('down');
    if (k === 'flare') { if (state === 'playing') game.flare(); } else touch.add(k);
  });
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
}
addEventListener('touchstart', () => touchEl.classList.remove('hidden'), { once: true, passive: true });
hudEl.querySelector('.pause-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state === 'playing') onPress('KeyP');
});
// Tapping or clicking a menu screen works like Enter (or carries on when paused).
screenEl.addEventListener('pointerdown', (e) => {
  sound.unlock();
  const pick = e.target.closest('[data-level]');
  const rowEl = e.target.closest('[data-row]');
  if (e.target.closest('[data-action="settings"]')) {
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
  switch (ev.type) {
    case 'oil': say('+ Oil'); break;
    case 'buoy':
      if (!game.lighthouseActive) say(`Buoy lit (${game.buoysLit} / ${game.buoys.length})`);
      break;
    case 'allBuoys': say('The lighthouse is awake! Sail to it.', 4); break;
    case 'hit': say('A shadow stole some oil!', 1.5); break;
    case 'noFlare': say('Not enough oil for a flare', 1.5); break;
  }
}

// ---------- Main loop ----------
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}

// One step of the game: input, rules, drawing and HUD.
function tick(dt) {
  time += dt;
  const pad = readGamepad(); // read every frame so menu buttons work too
  if (state === 'playing') {
    checkTips();
    const b = game.boat;
    const nearest = Math.min(99, ...game.creatures.map((c) => Math.hypot(c.x - b.x, c.z - b.z)));
    sound.tension = Math.max(0, Math.min(1, (10 - nearest) / 8));
    sound.danger = Math.max(0, Math.min(1, (30 - game.oil) / 30));
  } else {
    sound.tension = 0;
    sound.danger = 0;
  }
  if (state === 'playing') {
    game.update(dt, readInput(pad));
    for (const ev of game.events) handleEvent(ev);
    game.events.length = 0;
    if (game.result === 'lost') {
      state = 'gameOver';
      showScreen('gameOver');
    } else if (game.result === 'won') {
      lastClear = { time: game.time, best: recordClear(levelIndex, game.time) };
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
window.lanternDrift = {
  get game() { return game; },
  get state() { return state; },
  startLevel,
  save,
  step(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60);
  },
  screenshot() {
    wantScreenshot = true;
    tick(0);
  },
};

applySettings();
showScreen('title');
requestAnimationFrame(frame);
