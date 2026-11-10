// Level editor: paint a 32 x 16 map, check it's fair, play it, and share it as a code or link.
// It's plain DOM (a grid of cells) on top of the game; the game itself never sees the editor,
// only the finished level definition passed to onPlay.
import { checkLevel, encodeLevel, decodeLevel } from './levels.js';

const COLS = 32, ROWS = 16;
const STORE_KEY = 'lanternDrift.editor.v1';
const TOOLS = [
  { ch: '.', label: 'Water', key: '1' },
  { ch: '#', label: 'Building', key: '2' },
  { ch: 'u', label: 'Buoy', key: '3' },
  { ch: 'o', label: 'Oil', key: '4' },
  { ch: 'c', label: 'Shadow', key: '5' },
  { ch: 'B', label: 'Boat start', key: '6' },
  { ch: 'L', label: 'Lighthouse', key: '7' },
  { ch: '>', label: 'Current →', key: '8' },
  { ch: 'v', label: 'Current ↓', key: '9' },
  { ch: '<', label: 'Current ←', key: '0' },
  { ch: '^', label: 'Current ↑', key: '-' },
];
const UNIQUE = new Set(['B', 'L']); // only one of these per map

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

export function createEditor({ onPlay, onClose }) {
  const el = document.createElement('div');
  el.id = 'editor';
  el.className = 'hidden';
  el.innerHTML = `
    <div class="bar">
      <b>Level editor</b>
      <button data-act="play" title="Enter">▶ Play</button>
      <button data-act="share">Share code</button>
      <button data-act="load">Load code</button>
      <button data-act="clear">Clear</button>
      <button data-act="close" title="Esc">Back</button>
    </div>
    <div class="tools"></div>
    <div class="grid" style="--cols:${COLS}"></div>
    <p class="status"></p>
    <p class="help">Click or drag to paint · right-click to erase · number keys pick a tool · Enter plays · Esc goes back</p>`;
  document.body.appendChild(el);

  let map = load() || blankMap();
  let tool = '#';
  let painting = null; // the character being painted while the pointer is held

  const toolsEl = el.querySelector('.tools');
  toolsEl.innerHTML = TOOLS.map((t) => `<button data-ch="${t.ch}" class="t t${cls(t.ch)}"><i></i>${t.label}<small>${t.key}</small></button>`).join('');
  const gridEl = el.querySelector('.grid');
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
  const statusEl = el.querySelector('.status');

  function cls(ch) {
    return { '.': 'water', '#': 'wall', u: 'buoy', o: 'oil', c: 'shadow', B: 'boat', L: 'light', '>': 'cur', '<': 'cur', '^': 'cur', v: 'cur' }[ch];
  }
  const ARROWS = { '>': '→', '<': '←', '^': '↑', v: '↓' };

  function draw() {
    for (const cell of cells) {
      const ch = map[cell.dataset.r][cell.dataset.c];
      cell.className = cls(ch);
      cell.textContent = ARROWS[ch] || '';
    }
    for (const b of toolsEl.querySelectorAll('button')) b.classList.toggle('sel', b.dataset.ch === tool);
    const problems = checkLevel(def());
    statusEl.textContent = problems.length ? `⚠ ${problems[0]}` : '✓ Ready to play';
    statusEl.classList.toggle('bad', problems.length > 0);
  }

  const isEdge = (c, r) => r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
  function set(c, r, ch) {
    if (isEdge(c, r) && ch !== '#' && ch !== 'L') return; // keep the outer wall closed
    // Only one boat start and one lighthouse: remove the old one (a wall again if it was on the edge).
    if (UNIQUE.has(ch)) {
      map = map.map((row, rr) => [...row].map((x, cc) => (x === ch ? (isEdge(cc, rr) ? '#' : '.') : x)).join(''));
    }
    map[r] = map[r].slice(0, c) + ch + map[r].slice(c + 1);
  }

  function def() {
    return { name: 'Your level', drain: 2.3, creatureSpeed: 3.2, lungeCooldown: 3, map };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* not saved */ }
  }
  function load() {
    try {
      const m = JSON.parse(localStorage.getItem(STORE_KEY));
      if (Array.isArray(m) && m.length === ROWS && m.every((row) => typeof row === 'string' && row.length === COLS)) return m;
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
    const code = encodeLevel(map);
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
      setMap(decodeLevel(input.includes('level=') ? input.split('level=')[1] : input));
    } catch (err) {
      statusEl.textContent = `⚠ ${err.message}`;
    }
  }

  // Shared maps may be any size up to the editor's; fit them into 32 x 16 with walls around.
  function setMap(rows) {
    const out = blankMap().map((row) => row.replace(/[^#]/g, '.'));
    rows.slice(0, ROWS).forEach((row, r) => {
      for (let c = 0; c < Math.min(COLS, row.length); c++) out[r] = out[r].slice(0, c) + row[c] + out[r].slice(c + 1);
    });
    map = out;
    save();
    draw();
  }

  // ---- input ----
  gridEl.addEventListener('contextmenu', (e) => e.preventDefault());
  gridEl.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('[data-c]');
    if (!cell) return;
    e.preventDefault();
    gridEl.setPointerCapture(e.pointerId);
    painting = e.button === 2 ? '.' : tool;
    set(Number(cell.dataset.c), Number(cell.dataset.r), painting);
    draw();
  });
  gridEl.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit && hit.closest && hit.closest('#editor [data-c]');
    if (!cell) return;
    const c = Number(cell.dataset.c), r = Number(cell.dataset.r);
    if (map[r][c] === painting) return;
    set(c, r, painting);
    draw();
  });
  const stop = () => { if (painting) { painting = null; save(); } };
  gridEl.addEventListener('pointerup', stop);
  gridEl.addEventListener('pointercancel', stop);

  toolsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ch]');
    if (b) { tool = b.dataset.ch; draw(); }
  });
  el.querySelector('.bar').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'play') play();
    else if (act === 'share') share();
    else if (act === 'load') loadCode();
    else if (act === 'clear') { map = blankMap().map((row) => row.replace(/[^#]/g, '.')); save(); draw(); }
    else if (act === 'close') onClose();
  });

  return {
    el,
    open(rows) {
      if (rows) setMap(rows);
      el.classList.remove('hidden');
      draw();
    },
    close() {
      el.classList.add('hidden');
    },
    // Keys while the editor is open. Returns true if the key was used.
    key(code) {
      if (code === 'Escape') { onClose(); return true; }
      if (code === 'Enter') { play(); return true; }
      const t = TOOLS.find((x) => code === (x.key === '-' ? 'Minus' : `Digit${x.key}`));
      if (t) { tool = t.ch; draw(); return true; }
      return false;
    },
  };
}
