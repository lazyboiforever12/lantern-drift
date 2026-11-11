// Minimap: a small 2D canvas in the corner (plain Canvas 2D, separate from the WebGL scene).
// The map of walls and currents is drawn once per level into an offscreen canvas; each frame
// only the buoys, shards, lighthouse and the boat are drawn on top. Shadows are left off on
// purpose, so the map helps you find your way without taking the fear away.
import { CURRENTS } from './levels.js';

export class Minimap {
  constructor(parent) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.base = null;
    this.levelKey = null;
  }

  // Build the static layer for a level: water, walls and current arrows.
  prepare(game) {
    if (this.levelKey === game.def && this.gatesOpen === game.gatesOpen) return;
    this.levelKey = game.def;
    this.gatesOpen = game.gatesOpen; // redrawn when floodgates sink
    const { grid, width, height } = game.level;
    const px = Math.max(2, Math.floor(150 / Math.max(width, height * 1.6)));
    this.px = px;
    const base = document.createElement('canvas');
    base.width = width * px;
    base.height = height * px;
    const c = base.getContext('2d');
    for (let r = 0; r < height; r++) {
      for (let col = 0; col < width; col++) {
        const ch = grid[r][col];
        const shutGate = ch === 'd' && !game.gatesOpen;
        c.fillStyle = ch === '#' ? '#5a4f48' : shutGate ? '#3f9c8a' : CURRENTS[ch] ? '#1d5770' : ch === 'w' ? '#0c1a24' : '#17394a';
        c.fillRect(col * px, r * px, px, px);
      }
    }
    this.base = base;
    this.canvas.width = base.width;
    this.canvas.height = base.height;
  }

  draw(game, time) {
    this.prepare(game);
    const ctx = this.ctx;
    const s = this.px / game.level.cell; // world units to minimap pixels
    ctx.drawImage(this.base, 0, 0);
    const dot = (x, z, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x * s, z * s, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const sh of game.shards) if (!sh.taken) dot(sh.x, sh.z, 2, '#ffd27a');
    for (const u of game.buoys) dot(u.x, u.z, 3, u.lit ? '#9fe8d6' : '#e0533a');
    const lh = game.lighthouse;
    const pulse = game.lighthouseActive ? 4 + Math.sin(time * 6) * 1.5 : 3;
    dot(lh.x, lh.z, pulse, game.lighthouseActive ? '#fff1b8' : '#a07a40');
    // The boat: a small arrow pointing the way it faces.
    const b = game.boat;
    ctx.save();
    ctx.translate(b.x * s, b.z * s);
    ctx.rotate(-b.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(3.5, -3.5);
    ctx.lineTo(-3.5, -3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
