// Level editor: paint a 32 x 16 map, check it's fair, play it, and share it as a link.
// It's plain DOM (a grid of cells) on top of the game; the game itself never sees the editor,
// only the finished level definition passed to onPlay.
//
// Tools: brush (paint as you drag), box (drag a rectangle), fill (flood a connected area),
// plus a mirror switch that paints the other half of the map too. Undo / redo keep 100 steps.
import { checkLevel, encodeShare, decodeShare, customLevel, DIFFICULTIES, TWISTS, WEATHERS } from './levels.js';
import { generateVoyage } from './voyages.js';

const COLS = 32, ROWS = 16;
const STORE_KEY = 'lanternDrift.editor.v2';
const OLD_STORE_KEY = 'lanternDrift.editor.v1';
const TOOLS = [
  { ch: '.', label: 'Water', key: '1', tip: 'Open water the boat can sail on (right-click also paints water)' },
  { ch: '#', label: 'Building', key: '2', tip: 'Blocks the boat and the shadows. Use them to make streets and hiding places' },
  { ch: 'u', label: 'Buoy', key: '3', tip: 'Sail past to light it. Light every buoy to wake the lighthouse' },
  { ch: 'o', label: 'Oil', key: '4', tip: 'Refills the lantern. Long levels need more of these' },
  { ch: 'c', label: 'Shadow', key: '5', tip: 'Where a shadow creature starts. Keep them away from the boat start' },
  { ch: 'q', label: 'Wisp', key: ']', tip: 'A small, fast shadow. Steals less oil' },
  { ch: 'g', label: 'Brute', key: '#', tip: 'A big, slow shadow that steals more. The first flare only staggers it' },
  { ch: 'B', label: 'Boat start', key: '6', tip: 'Where the player begins (only one)' },
  { ch: 'L', label: 'Lighthouse', key: '7', tip: 'The goal (only one). It needs water next to it' },
  { ch: '>', label: 'Current →', key: '8', tip: 'Water that pushes the boat right' },
  { ch: 'v', label: 'Current ↓', key: '9', tip: 'Water that pushes the boat down' },
  { ch: '<', label: 'Current ←', key: '0', tip: 'Water that pushes the boat left' },
  { ch: '^', label: 'Current ↑', key: '-', tip: 'Water that pushes the boat up' },
  { ch: 'w', label: 'Whirlpool', key: '=', tip: 'Pulls in the boat and shadows. The middle costs oil, but stuns shadows' },
  { ch: 'e', label: 'Ember shard', key: '[', tip: 'Optional treasure worth Embers' },
];
const MODES = [
  { id: 'brush', label: '✎ Brush', key: 'KeyP', tip: 'Paint cells as you drag (P)' },
  { id: 'box', label: '▭ Box', key: 'KeyR', tip: 'Drag to fill a rectangle (R)' },
  { id: 'fill', label: '◍ Fill', key: 'KeyF', tip: 'Fill a connected area of the same kind (F)' },
];
const UNIQUE = new Set(['B', 'L']); // only one of these per map
const MIRROR_CH = { '>': '<', '<': '>' };
const GUIDE = [
  'Paint <b>buildings</b> to make streets. The outer wall must stay closed.',
  'Place one <b>boat start</b> and one <b>lighthouse</b> (the goal), far apart.',
  'Add <b>buoys</b>. The player lights them all to wake the lighthouse.',
  'Add <b>oil cans</b> so the lantern lasts, and some <b>shadows</b> for danger.',
  'Optional: <b>currents</b>, a difficulty and a twist (storm or burning-out buoys).',
  'When the check says <b>Ready</b>, press <b>Play</b> to test it, then <b>Share</b> the link.',
];

function blankMap() {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let row = '';
    for (let c = 0; c < COLS; c++) row += r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.';
    rows.push(row);
  }
  const set = (c, r, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };
  set(1, 1, 'B');
  set(29, 13, 'L');
  set(10, 5, 'u');
  set(20, 10, 'u');
  set(6, 10, 'o');
  set(16, 4, 'c');
  return rows;
}
const emptyMap = () => blankMap().map((row) => row.replace(/[^#]/g, '.'));

export function createEditor({ onPlay, onClose }) {
  const el = document.createElement('div');
  el.id = 'editor';
  el.className = 'hidden';
  el.innerHTML = `
    <div class="bar">
      <b>Level editor</b>
      <button data-act="play" title="Test your level (Enter)">▶ Play</button>
      <button data-act="share" title="Copy a link to this level">Share link</button>
      <button data-act="load" title="Open a level code or link">Load</button>
      <button data-act="random" title="Start from a random generated town">🎲 Random</button>
      <button data-act="undo" title="Undo (Ctrl+Z)">↶</button>
      <button data-act="redo" title="Redo (Ctrl+Y)">↷</button>
      <button data-act="clear" title="Empty the map">Clear</button>
      <button data-act="help" title="How to build a level">?</button>
      <button data-act="close" title="Back to the title (Esc)">Back</button>
    </div>
    <div class="settings-row">
      <label>Name <input class="name" maxlength="40" placeholder="Your level"></label>
      <label>Difficulty <select class="difficulty">${DIFFICULTIES.map((d, i) => `<option value="${i}">${d.name}</option>`).join('')}</select></label>
      <label>Twist <select class="twist">${TWISTS.map((t, i) => `<option value="${i}">${t.name}</option>`).join('')}</select></label>
      <label>Weather <select class="weather">${WEATHERS.map((w, i) => `<option value="${i}">${w.name}</option>`).join('')}</select></label>
    </div>
    <div class="modes-row">${MODES.map((m) => `<button data-mode="${m.id}" title="${m.tip}">${m.label}</button>`).join('')}
      <button data-act="mirror" title="Paint both halves of the map at once (M)">⇆ Mirror</button></div>
    <div class="tools"></div>
    <ol class="guide hidden">${GUIDE.map((g) => `<li>${g}</li>`).join('')}</ol>
    <div class="grid" style="--cols:${COLS}"></div>
    <p class="status"></p>
    <p class="stats"></p>
    <p class="help">Drag to paint · right-click erases · 1-0 pick a tool · P / R / F brush, box, fill · Ctrl+Z undo · Enter plays · Esc back</p>`;
  document.body.appendChild(el);

  const saved = load();
  let map = saved ? saved.map : blankMap();
  const opts = { difficulty: saved ? saved.difficulty : 1, twist: saved ? saved.twist : 0, weather: saved ? saved.weather : 0, name: saved ? saved.name : '' };
  let tool = '#';
  let mode = 'brush';
  let mirror = false;
  let painting = null;   // the character being painted while the pointer is held
  let boxStart = null;   // first corner while dragging a box
  let boxEnd = null;
  const undoStack = [];
  const redoStack = [];

  const $ = (sel) => el.querySelector(sel);
  const toolsEl = $('.tools');
  toolsEl.innerHTML = TOOLS.map((t) => `<button data-ch="${t.ch}" class="t t${cls(t.ch)}" title="${t.tip}"><i></i>${t.label}<small>${t.key}</small></button>`).join('');
  const gridEl = $('.grid');
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.dataset.c = c;
      cell.dataset.r = r;
      gridEl.appendChild(cell);
      cells.push(cell);
    }
  }
  const statusEl = $('.status');
  const statsEl = $('.stats');
  const nameEl = $('.name'), diffEl = $('.difficulty'), twistEl = $('.twist'), weatherEl = $('.weather');

  function cls(ch) {
    return { '.': 'water', '#': 'wall', u: 'buoy', o: 'oil', c: 'shadow', q: 'wisp', g: 'brute', B: 'boat', L: 'light', '>': 'cur', '<': 'cur', '^': 'cur', v: 'cur', w: 'whirl', e: 'shard' }[ch];
  }
  const ARROWS = { '>': '→', '<': '←', '^': '↑', v: '↓' };

  const inBox = (c, r) => boxStart && boxEnd
    && c >= Math.min(boxStart[0], boxEnd[0]) && c <= Math.max(boxStart[0], boxEnd[0])
    && r >= Math.min(boxStart[1], boxEnd[1]) && r <= Math.max(boxStart[1], boxEnd[1]);

  function draw() {
    for (const cell of cells) {
      const c = Number(cell.dataset.c), r = Number(cell.dataset.r);
      const ch = map[r][c];
      cell.className = cls(ch) + (inBox(c, r) ? ' pre' : '') + (mirror && c === COLS / 2 ? ' axis' : '');
      cell.textContent = ARROWS[ch] || '';
    }
    for (const b of toolsEl.querySelectorAll('button')) b.classList.toggle('sel', b.dataset.ch === tool);
    for (const b of el.querySelectorAll('[data-mode]')) b.classList.toggle('sel', b.dataset.mode === mode);
    $('[data-act="mirror"]').classList.toggle('sel', mirror);
    $('[data-act="undo"]').disabled = !undoStack.length;
    $('[data-act="redo"]').disabled = !redoStack.length;
    nameEl.value = opts.name;
    diffEl.value = opts.difficulty;
    twistEl.value = opts.twist;
    weatherEl.value = opts.weather;
    const problems = checkLevel(def());
    statusEl.textContent = problems.length ? `⚠ ${problems[0]}` : '✓ Ready to play';
    statusEl.classList.toggle('bad', problems.length > 0);
    statsEl.innerHTML = stats();
  }

  // Counts and a friendly tip about balance.
  function stats() {
    const count = (ch) => map.reduce((n, row) => n + row.split(ch).length - 1, 0);
    const water = COLS * ROWS - count('#') - count('L');
    const buoys = count('u'), oils = count('o'), shadows = count('c') + count('q') + count('g'), shards = count('e'), whirls = count('w');
    let tip = '';
    if (oils === 0) tip = 'Add some oil cans, or the lantern will run dry.';
    else if (water / oils > 70) tip = 'Tip: about one oil can per 60 water cells keeps a level fair.';
    else if (shadows === 0) tip = 'Tip: add a shadow or two, so there is some danger.';
    else if (buoys > 8) tip = 'Lots of buoys: this will be a long level.';
    else if (shadows > 8) tip = 'That is a lot of shadows. Make sure there are walls to hide behind!';
    const extra = `${whirls ? ` · ${whirls} whirlpool${whirls === 1 ? '' : 's'}` : ''}${shards ? ` · ${shards} shard${shards === 1 ? '' : 's'}` : ''}`;
    return `${water} water cells · ${buoys} buoy${buoys === 1 ? '' : 's'} · ${oils} oil · ${shadows} shadow${shadows === 1 ? '' : 's'}${extra}${tip ? ` · <em>${tip}</em>` : ''}`;
  }

  const isEdge = (c, r) => r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
  function setOne(c, r, ch) {
    if (isEdge(c, r) && ch !== '#' && ch !== 'L') return; // keep the outer wall closed
    // Only one boat start and one lighthouse: remove the old one (a wall again if it was on the edge).
    if (UNIQUE.has(ch)) {
      map = map.map((row, rr) => [...row].map((x, cc) => (x === ch ? (isEdge(cc, rr) ? '#' : '.') : x)).join(''));
    }
    map[r] = map[r].slice(0, c) + ch + map[r].slice(c + 1);
  }
  // Paint a cell, and its mirror image when Mirror is on (currents flip direction).
  function set(c, r, ch) {
    setOne(c, r, ch);
    if (mirror && !UNIQUE.has(ch)) setOne(COLS - 1 - c, r, MIRROR_CH[ch] || ch);
  }

  // Flood fill: replace the connected area of the clicked kind (4-way neighbours).
  function fill(c, r, ch) {
    const from = map[r][c];
    if (from === ch || UNIQUE.has(ch)) { set(c, r, ch); return; }
    const queue = [[c, r]];
    const seen = new Set([`${c},${r}`]);
    while (queue.length) {
      const [x, y] = queue.pop();
      set(x, y, ch);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || map[ny][nx] !== from) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
  }

  function remember() {
    undoStack.push(map.slice());
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(map.slice());
    map = undoStack.pop();
    save();
    draw();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(map.slice());
    map = redoStack.pop();
    save();
    draw();
  }

  const def = () => customLevel({ map, ...opts });

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ map, ...opts })); } catch { /* not saved */ }
  }
  function load() {
    const valid = (m) => Array.isArray(m) && m.length === ROWS && m.every((row) => typeof row === 'string' && row.length === COLS);
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && valid(s.map)) return { map: s.map, difficulty: s.difficulty | 0, twist: s.twist | 0, weather: s.weather | 0, name: String(s.name || '') };
      const old = JSON.parse(localStorage.getItem(OLD_STORE_KEY));
      if (valid(old)) return { map: old, difficulty: 1, twist: 0, weather: 0, name: '' };
    } catch { /* fresh map */ }
    return null;
  }

  function play() {
    const problems = checkLevel(def());
    if (problems.length) {
      statusEl.textContent = `⚠ ${problems[0]}`;
      return;
    }
    save();
    onPlay(def());
  }

  async function share() {
    const code = encodeShare({ map, ...opts });
    const url = `${location.origin}${location.pathname}#level=${code}`;
    history.replaceState(null, '', `#level=${code}`);
    try {
      await navigator.clipboard.writeText(url);
      statusEl.textContent = '✓ Link copied! Anyone who opens it gets your level.';
    } catch {
      prompt('Copy this link to share your level:', url);
    }
  }

  function loadCode() {
    const input = prompt('Paste a Lantern Drift level code or link:');
    if (!input) return;
    try {
      setLevel(decodeShare(input.includes('level=') ? input.split('level=')[1] : input));
    } catch (err) {
      statusEl.textContent = `⚠ ${err.message}`;
    }
  }

  // A random town from the voyage generator, sized to fit the editor.
  function randomMap() {
    remember();
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const v = generateVoyage(seed, 1 + Math.floor(Math.random() * 4), 'none', { width: COLS, height: ROWS });
    map = v.map.slice();
    opts.name = v.name;
    save();
    draw();
  }

  // Shared maps may be any size up to the editor's; fit them into 32 x 16 with walls around.
  function setLevel(level) {
    remember();
    const rows = Array.isArray(level) ? level : level.map;
    const out = emptyMap();
    rows.slice(0, ROWS).forEach((row, r) => {
      for (let c = 0; c < Math.min(COLS, row.length); c++) out[r] = out[r].slice(0, c) + row[c] + out[r].slice(c + 1);
    });
    map = out;
    if (!Array.isArray(level)) Object.assign(opts, { difficulty: level.difficulty, twist: level.twist, weather: level.weather | 0, name: level.name });
    save();
    draw();
  }

  // ---- input ----
  const cellAt = (x, y) => {
    const hit = document.elementFromPoint(x, y);
    const cell = hit && hit.closest && hit.closest('#editor [data-c]');
    return cell ? [Number(cell.dataset.c), Number(cell.dataset.r)] : null;
  };
  gridEl.addEventListener('contextmenu', (e) => e.preventDefault());
  gridEl.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('[data-c]');
    if (!cell) return;
    e.preventDefault();
    gridEl.setPointerCapture(e.pointerId);
    const c = Number(cell.dataset.c), r = Number(cell.dataset.r);
    painting = e.button === 2 ? '.' : tool;
    remember();
    if (mode === 'fill') {
      fill(c, r, painting);
      painting = null;
      save();
    } else if (mode === 'box') {
      boxStart = boxEnd = [c, r];
    } else {
      set(c, r, painting);
    }
    draw();
  });
  gridEl.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    const [c, r] = at;
    if (mode === 'box') {
      if (boxEnd[0] === c && boxEnd[1] === r) return;
      boxEnd = at;
    } else {
      if (map[r][c] === painting) return;
      set(c, r, painting);
    }
    draw();
  });
  const stop = () => {
    if (!painting) return;
    if (mode === 'box' && boxStart) {
      if (UNIQUE.has(painting)) set(boxEnd[0], boxEnd[1], painting);
      else {
        for (let r = Math.min(boxStart[1], boxEnd[1]); r <= Math.max(boxStart[1], boxEnd[1]); r++) {
          for (let c = Math.min(boxStart[0], boxEnd[0]); c <= Math.max(boxStart[0], boxEnd[0]); c++) set(c, r, painting);
        }
      }
      boxStart = boxEnd = null;
    }
    painting = null;
    save();
    draw();
  };
  gridEl.addEventListener('pointerup', stop);
  gridEl.addEventListener('pointercancel', stop);

  toolsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ch]');
    if (b) { tool = b.dataset.ch; draw(); }
  });
  el.querySelector('.modes-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) { mode = b.dataset.mode; draw(); }
  });
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'play') play();
    else if (act === 'share') share();
    else if (act === 'load') loadCode();
    else if (act === 'random') randomMap();
    else if (act === 'undo') undo();
    else if (act === 'redo') redo();
    else if (act === 'mirror') { mirror = !mirror; draw(); }
    else if (act === 'help') $('.guide').classList.toggle('hidden');
    else if (act === 'clear') { remember(); map = emptyMap(); save(); draw(); }
    else if (act === 'close') onClose();
  });
  nameEl.addEventListener('input', () => { opts.name = nameEl.value; save(); });
  diffEl.addEventListener('change', () => { opts.difficulty = Number(diffEl.value); save(); draw(); });
  twistEl.addEventListener('change', () => { opts.twist = Number(twistEl.value); save(); draw(); });
  weatherEl.addEventListener('change', () => { opts.weather = Number(weatherEl.value); save(); draw(); });
  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) while the editor is open, but not while typing a name.
  addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden') || e.target === nameEl || !(e.ctrlKey || e.metaKey)) return;
    if (e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) { e.preventDefault(); redo(); }
  });

  return {
    el,
    // level: optional rows (old share codes) or { map, difficulty, twist, name } from decodeShare.
    open(level) {
      if (level) setLevel(level);
      el.classList.remove('hidden');
      draw();
    },
    close() {
      el.classList.add('hidden');
    },
    // Keys while the editor is open. Returns true if the key was used.
    key(code, e) {
      if (e && (e.ctrlKey || e.metaKey)) return false; // undo / redo are handled above
      if (code === 'Escape') { onClose(); return true; }
      if (code === 'Enter') { play(); return true; }
      if (code === 'KeyM') { mirror = !mirror; draw(); return true; }
      const m = MODES.find((x) => x.key === code);
      if (m) { mode = m.id; draw(); return true; }
      const KEY_CODES = { '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '#': 'Backslash' };
      const t = TOOLS.find((x) => code === (KEY_CODES[x.key] || `Digit${x.key}`));
      if (t) { tool = t.ch; draw(); return true; }
      return false;
    },
  };
}
