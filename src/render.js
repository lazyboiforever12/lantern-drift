// Draws a Game with raw WebGL2.
import { createContext, createProgram, deleteMesh } from './gl.js';
import { vertexShader, fragmentShader, MAX_LIGHTS, MAX_OCCLUDERS } from './shaders.js';
import { CURRENTS } from './levels.js';
import { PostProcess } from './post.js';
import { createTextures, TEX } from './textures.js';
import { Particles } from './particles.js';
import { perspective, lookAt, multiply, model, IDENTITY, pivotRotate } from './math.js';
import {
  boatMesh, designBoatMesh, boatPartMesh, buoyMesh, oilMesh, creatureMesh, lighthouseMesh, buildingsMesh, propsMesh, buildingHeight, waterMesh, foamMesh, streakMesh, whirlpoolMesh, shardMesh,
} from './meshes.js';

const WHITE = [1, 1, 1];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const NO_TEX = [-1, -1, 1];
// Flips y: drawing with this mirrors the world in the water plane.
const MIRROR_Y = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const WAKE_LIFE = 1.4;   // seconds a fleck of foam lasts
const WAKE_MAX = 60;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = (this.gl = createContext(canvas));
    this.program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(this.program);

    const names = [
      'uViewProj', 'uModel', 'uTime', 'uWater', 'uTint', 'uEmissiveBoost', 'uCamPos',
      'uAmbient', 'uMoonDir', 'uMoonColor', 'uLightCount', 'uLightPos', 'uLightColor', 'uLightRadius',
      'uTextures', 'uTexSide', 'uTexTop', 'uTexScale', 'uReflection', 'uReflect', 'uViewport', 'uClip',
      'uHeightMap', 'uGridSize', 'uCell', 'uRayShadows', 'uOccluderCount', 'uOccluders', 'uFog',
    ];
    this.u = {};
    for (const n of names) this.u[n] = gl.getUniformLocation(this.program, n);

    // Textures live on unit 2 and the reflection on unit 3 (units 0 and 1 belong to post-processing).
    // Different sampler types must never share a unit, or draws fail.
    this.textures = createTextures(gl);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textures);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.u.uTextures, 2);
    gl.uniform1i(this.u.uReflection, 3);
    gl.uniform1i(this.u.uHeightMap, 4); // the level's building heights, for ray-traced shadows
    this.heightMap = null;
    this.occluders = new Float32Array(MAX_OCCLUDERS * 4);
    this.reflection = null; // offscreen target for the mirrored scene, made on first use

    this.meshes = {
      boat: boatMesh(gl),
      buoyOff: buoyMesh(gl, [1.0, 0.25, 0.2]),
      buoyOn: buoyMesh(gl, [0.55, 1.0, 0.9]),
      oil: oilMesh(gl),
      creature: creatureMesh(gl),
      lighthouse: lighthouseMesh(gl),
      foam: foamMesh(gl),
      streak: streakMesh(gl),
      whirlpool: whirlpoolMesh(gl),
      shard: shardMesh(gl),
    };
    this.wake = [];       // foam flecks: { x, z, life, spin }
    this.wakeTimer = 0;
    this.levelMeshes = null;
    this.levelKey = null;
    this.cam = { x: 0, z: 0 };
    this.lastGame = null;

    // Optional extras. If post-processing can't start (old GPU or driver), draw straight to the screen.
    // resolution: 'auto' (sharp but capped for speed), 'native' (every screen pixel), or a height
    // such as 1080 / 1440 / 2160: the scene is rendered at that size and scaled to fit the window.
    this.settings = { bloom: true, shake: true, rain: true, reflections: true, flashes: true, rtShadows: true, fog: true, resolution: 'auto' };
    // 0 = full quality. Raised automatically when frames are slow: 1 no reflections, 2 no bloom, 3 lower resolution.
    this.autoLevel = 0;
    this.showcase = false; // Boatyard preview camera
    try {
      this.post = new PostProcess(gl);
    } catch (err) {
      console.warn('Post-processing off:', err.message);
      this.post = null;
    }
    this.particles = new Particles(gl);
    this.shakeAmount = 0;
    this.fade = 0;
    this.timers = { rain: 0, ember: 0, wisp: 0 };

    this.lightPos = new Float32Array(MAX_LIGHTS * 3);
    this.lightColor = new Float32Array(MAX_LIGHTS * 3);
    this.lightRadius = new Float32Array(MAX_LIGHTS);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.01, 0.012, 0.025, 1);
  }

  // Size of the drawing buffer in pixels for the chosen resolution.
  renderSize() {
    const cw = Math.max(1, this.canvas.clientWidth), ch = Math.max(1, this.canvas.clientHeight);
    const res = this.settings.resolution;
    let scale;
    if (res === 'native') scale = window.devicePixelRatio || 1;
    else if (typeof res === 'number') scale = res / ch;
    else scale = Math.min(window.devicePixelRatio || 1, 1.5);
    // autoLevel 3 also lowers the resolution for slow GPUs (see main.js quality scaling).
    if (this.autoLevel >= 3) scale *= 0.7;
    const max = this.maxSize || (this.maxSize = Math.min(this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE), 8192));
    scale = Math.min(scale, max / cw, max / ch);
    return [Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(ch * scale))];
  }

  // GPU back-pressure for the free-running frame loop: a fence is dropped into the command stream
  // after each frame, and the next frame waits until the GPU has passed it. Without this the CPU
  // could queue frames faster than the GPU draws them, which only adds input lag.
  gpuReady() {
    const gl = this.gl;
    if (!this.fence) return true;
    const status = gl.clientWaitSync(this.fence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) return false;
    gl.deleteSync(this.fence);
    this.fence = null;
    return true;
  }

  markFrame() {
    const gl = this.gl;
    if (this.fence) gl.deleteSync(this.fence);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }

  get raytracing() {
    return this.settings.rtShadows && this.autoLevel < 2;
  }

  resize() {
    const [w, h] = this.renderSize();
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return [w, h];
  }

  get postActive() {
    return !!this.post && this.settings.bloom && this.autoLevel < 2;
  }

  // Shake the camera a little (hits, lunges, bumps). Amount is in world units.
  shake(amount) {
    if (this.settings.shake) this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  // Particle effects for game events. ev comes from Game.events.
  effect(ev, game) {
    const P = this.particles;
    const b = game.boat;
    switch (ev.type) {
      case 'flare':
        P.burst(b.x, 2.2, b.z, { count: 50, speed: 12, up: 5, life: 1.0, size: 0.09, color: [0.9, 0.6, 0.3] });
        for (const c of game.creatures) {
          if (c.stun > 2) P.burst(c.x, 1, c.z, { count: 14, speed: 3, up: 2, life: 0.8, color: [0.7, 0.4, 1.0], gravity: 0 });
        }
        this.shake(0.25);
        break;
      case 'oil':
        P.burst(ev.x, 0.6, ev.z, { count: 26, speed: 3.5, up: 4, life: 0.8, color: [1.0, 0.6, 0.2] });
        break;
      case 'buoy':
        P.burst(ev.x, 1.4, ev.z, { count: 40, speed: 4, up: 5, life: 1.2, color: [0.5, 1.0, 0.9] });
        break;
      case 'allBuoys': {
        const lh = game.lighthouse;
        P.burst(lh.x, 6.5, lh.z, { count: 120, speed: 9, up: 6, life: 1.6, size: 0.2, color: [1.0, 0.9, 0.6] });
        break;
      }
      case 'hit':
        P.burst(b.x, 1.2, b.z, { count: 30, speed: 5, up: 3, life: 0.7, color: [1.0, 0.3, 0.4] });
        this.shake(0.6);
        break;
      case 'lunge':
        this.shake(0.08);
        break;
      case 'lightningWarn':
        P.burst(ev.x, 0.3, ev.z, { count: 12, speed: 1.2, up: 0.5, life: 1.2, size: 0.12, color: [0.7, 0.8, 1.0], gravity: 0 });
        break;
      case 'lightning': {
        // A jagged bolt from the clouds, built from short streak particles.
        let x = ev.x + (Math.random() - 0.5) * 3, z = ev.z + (Math.random() - 0.5) * 3, y = 16;
        const calm = !this.settings.flashes;
        for (let i = 0; i < 10; i++) {
          const nx = x + (ev.x - x) * 0.25 + (Math.random() - 0.5) * 1.6;
          const nz = z + (ev.z - z) * 0.25 + (Math.random() - 0.5) * 1.6;
          const ny = y - 1.6;
          P.spawn({ x: (x + nx) / 2, y: (y + ny) / 2, z: (z + nz) / 2, life: 0.25, size: 0.09,
            color: [0.85, 0.9, 1.0], alpha: calm ? 0.5 : 1, streak: 1, vx: (nx - x) / 2, vy: (ny - y) / 2, vz: (nz - z) / 2, drag: 0 });
          x = nx; y = ny; z = nz;
        }
        P.burst(ev.x, 0.4, ev.z, { count: 40, speed: 6, up: 4, life: 0.8, color: [0.75, 0.85, 1.0] });
        this.shake(calm ? 0.1 : 0.45);
        break;
      }
      case 'whirl':
        P.burst(ev.x, 0.4, ev.z, { count: 36, speed: 6, up: 4, life: 0.9, color: [0.7, 0.85, 0.95] });
        if (ev.boat) this.shake(0.4);
        break;
      case 'shard':
        P.burst(ev.x, 0.8, ev.z, { count: 30, speed: 4, up: 5, life: 1.0, size: 0.08, color: [1.0, 0.85, 0.45] });
        break;
      case 'buoyOut':
        P.burst(ev.x, 1.4, ev.z, { count: 16, speed: 1.5, up: 2, life: 1.0, color: [0.3, 0.45, 0.5], gravity: 0 });
        break;
      case 'bump':
        P.burst(b.x, 0.3, b.z, { count: 8, speed: 2, up: 2, life: 0.5, size: 0.08, color: [0.6, 0.75, 0.85] });
        this.shake(0.15);
        break;
      case 'win': {
        const lh = game.lighthouse;
        P.burst(lh.x, 6.5, lh.z, { count: 160, speed: 12, up: 8, life: 2, size: 0.22, color: [1.0, 0.85, 0.5] });
        break;
      }
    }
  }

  // Swap in the boat from the Boatyard (design, paint and lantern position).
  setBoat(boat, paint, stats) {
    const gl = this.gl;
    if (this.meshes.boat) deleteMesh(gl, this.meshes.boat);
    for (const p of this.boatParts || []) deleteMesh(gl, p.mesh);
    this.meshes.boat = designBoatMesh(gl, boat.design, paint, stats);
    // Moving parts are separate meshes, turned about their pivots every frame.
    this.boatParts = (boat.parts || []).map((part) => ({ ...part, mesh: boatPartMesh(gl, part, paint), angle: 0 }));
    this.boatSmoke = boat.smoke || [];
  }

  // The hull leans out of turns, pitches when speeding up or slowing down, and rocks on the waves.
  updateBoatTilt(game, time, dt, speed) {
    const b = game.boat;
    const t = this.tilt || (this.tilt = { roll: 0, pitch: 0, angle: b.angle, speed: 0 });
    const k = dt > 0 ? 1 / dt : 0;
    const turnRate = Math.atan2(Math.sin(b.angle - t.angle), Math.cos(b.angle - t.angle)) * k;
    const accel = (speed - t.speed) * k;
    t.angle = b.angle;
    t.speed = speed;
    const roll = Math.max(-0.28, Math.min(0.28, turnRate * speed * 0.03)) + Math.sin(time * 1.3 + b.x * 0.5) * 0.035;
    const pitch = Math.max(-0.12, Math.min(0.12, -accel * 0.012)) + Math.sin(time * 1.7 + b.z * 0.5) * 0.025;
    const ease = Math.min(1, dt * 5);
    t.roll += (roll - t.roll) * ease;
    t.pitch += (pitch - t.pitch) * ease;
  }

  // Advance each moving part. Propellers and paddle wheels spin faster as the boat speeds up.
  updateBoatParts(game, time, dt) {
    const speed = Math.hypot(game.boat.vx, game.boat.vz);
    for (const p of this.boatParts || []) {
      if (p.osc) p.angle = Math.sin(time * p.speed + p.pivot[2] * 3) * p.osc;
      else p.angle += (p.speed + (p.bySpeed || 0) * speed) * dt;
    }
  }

  // A firework: a bright burst high above the water, in a random festive colour.
  firework(x, z) {
    const colors = [[1, 0.75, 0.3], [0.5, 1, 0.9], [1, 0.45, 0.6], [0.7, 0.6, 1], [1, 0.95, 0.6]];
    const color = colors[Math.floor(Math.random() * colors.length)];
    this.particles.burst(x, 7 + Math.random() * 3, z, { count: 140, speed: 9, up: 3, life: 1.8, size: 0.2, color, gravity: -3 });
  }

  // Ambient particles: rain everywhere, embers from the lantern, wisps trailing the shadows.
  emitAmbient(game, dt, playing) {
    const P = this.particles;
    const t = this.timers;
    if (this.settings.rain) {
      t.rain += dt * 90;
      while (t.rain >= 1) {
        t.rain -= 1;
        const x = this.cam.x + (Math.random() - 0.5) * 44;
        const z = this.cam.z + (Math.random() - 0.5) * 30 - 2;
        const y = 9 + Math.random() * 3;
        // Life is set so each drop ends right at the water.
        P.spawn({ x, y, z, vx: -1.2, vy: -16, vz: 0.6, life: y / 16, size: 0.025,
          color: [0.45, 0.55, 0.7], alpha: 0.5, streak: 0.045 });
      }
    }
    if (!playing && !this.showcase) return;
    const b = game.boat;
    if (this.boatSmoke && this.boatSmoke.length) {
      t.smoke = (t.smoke || 0) + dt * 3 * this.boatSmoke.length;
      const c = Math.cos(b.angle), s = Math.sin(b.angle);
      while (t.smoke >= 1) {
        t.smoke -= 1;
        const [lx, ly, lz] = this.boatSmoke[Math.floor(Math.random() * this.boatSmoke.length)];
        P.spawn({ x: b.x + c * lx + s * lz, y: ly, z: b.z - s * lx + c * lz,
          vx: -b.vx * 0.3 + (Math.random() - 0.5) * 0.3, vy: 0.9 + Math.random() * 0.4, vz: -b.vz * 0.3 + (Math.random() - 0.5) * 0.3,
          life: 2.2, size: 0.12, grow: 0.25, color: [0.55, 0.55, 0.6], alpha: 0.22, drag: 0.6 });
      }
    }
    if (!playing) return;
    const st = game.stats; // embers rise from wherever this boat's lantern hangs
    t.ember += dt * (2 + 6 * game.oilPct / 100);
    while (t.ember >= 1) {
      t.ember -= 1;
      P.spawn({ x: b.x + Math.sin(b.angle) * st.lanternZ + (Math.random() - 0.5) * 0.2, y: st.lanternY + 0.15, z: b.z + Math.cos(b.angle) * st.lanternZ,
        vx: (Math.random() - 0.5) * 0.4, vy: 0.8 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.4,
        life: 1.2 + Math.random(), size: 0.05, color: [1.0, 0.65, 0.25], drag: 0.5 });
    }
    t.wisp += dt * 4 * game.creatures.length;
    while (t.wisp >= 1) {
      t.wisp -= 1;
      const c = game.creatures[Math.floor(Math.random() * game.creatures.length)];
      if (!c) break;
      P.spawn({ x: c.x + (Math.random() - 0.5) * 0.6, y: 0.8 + Math.random() * 0.5, z: c.z + (Math.random() - 0.5) * 0.6,
        vx: -c.vx * 0.2, vy: 0.3, vz: -c.vz * 0.2, life: 1.0, size: 0.18, grow: 0.2,
        color: c.lunge > 0 ? [0.9, 0.2, 0.5] : [0.35, 0.15, 0.6], alpha: 0.55, drag: 1 });
    }
  }

  prepareLevel(game) {
    if (this.levelKey === game.def) return;
    const gl = this.gl;
    if (this.levelMeshes) {
      deleteMesh(gl, this.levelMeshes.water);
      deleteMesh(gl, this.levelMeshes.buildings);
      deleteMesh(gl, this.levelMeshes.props);
    }
    this.levelMeshes = {
      water: waterMesh(gl, game.level),
      buildings: buildingsMesh(gl, game.level),
      props: propsMesh(gl, game.level),
    };
    // Cells with flowing water, for drawing drifting streaks.
    this.currentCells = [];
    const { grid, cell } = game.level;
    grid.forEach((row, r) => row.forEach((ch, c) => {
      const dir = CURRENTS[ch];
      if (dir) this.currentCells.push({ x: c * cell + cell / 2, z: r * cell + cell / 2, dir, angle: Math.atan2(dir.x, dir.z), seed: (c * 7 + r * 13) % 10 / 10 });
    }));
    this.uploadHeightMap(game.level);
    this.levelKey = game.def;
  }

  // One float per grid cell: the roof height of a building, or far below the water for open cells.
  // The shader walks this grid to trace shadow rays (see traceGrid in shaders.js).
  uploadHeightMap(level) {
    const gl = this.gl;
    const { grid, width, height } = level;
    const data = new Float32Array(width * height);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) data[r * width + c] = grid[r][c] === '#' ? buildingHeight(c, r) : -100;
    }
    if (!this.heightMap) this.heightMap = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.heightMap);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(this.program);
    gl.uniform2i(this.u.uGridSize, width, height);
    gl.uniform1f(this.u.uCell, level.cell);
  }

  draw(game, time, dt, { playing = true } = {}) {
    const gl = this.gl;
    const u = this.u;
    const [w, h] = this.resize();
    this.prepareLevel(game);

    // Camera follows the boat from above and behind (south).
    const b = game.boat;
    if (this.lastGame !== game) {
      this.cam.x = b.x;
      this.cam.z = b.z;
      this.lastGame = game;
      this.wake.length = 0;
      this.particles.clear();
      this.fade = 0;
    }
    this.fade = Math.min(1, this.fade + dt * 1.8);
    // The camera leads the boat a little in the direction it's moving, and rises as it speeds up,
    // so you see more of what's ahead.
    const follow = Math.min(1, dt * 4);
    const speed = Math.hypot(b.vx, b.vz);
    this.cam.x += (b.x + b.vx * 0.4 - this.cam.x) * follow;
    this.cam.z += (b.z + b.vz * 0.4 - this.cam.z) * follow;
    this.camHeight = (this.camHeight || 21) + (21 + Math.min(speed, 10) * 0.45 - (this.camHeight || 21)) * Math.min(1, dt * 1.5);
    this.updateBoatTilt(game, time, dt, speed);
    // Screen shake: a quick random jitter that dies away.
    this.shakeAmount *= Math.exp(-dt * 7);
    const sx = (Math.random() - 0.5) * this.shakeAmount, sz = (Math.random() - 0.5) * this.shakeAmount;
    let eye = [this.cam.x + sx, this.camHeight, this.cam.z + 6 + sz];
    let target = [this.cam.x + sx, 0, this.cam.z - 0.5 + sz];
    if (this.showcase) {
      // Boatyard preview: a close, low camera on the boat.
      eye = [b.x + 1.8, 5.4, b.z + 6.6];
      target = [b.x, 0.9, b.z];
    } else if (this.photo) {
      // Photo mode: a free orbit camera around the boat (yaw, pitch and distance from main.js).
      const p = this.photo;
      eye = [b.x + Math.sin(p.yaw) * Math.cos(p.pitch) * p.dist, 0.8 + Math.sin(p.pitch) * p.dist, b.z + Math.cos(p.yaw) * Math.cos(p.pitch) * p.dist];
      target = [b.x, 0.8, b.z];
    } else if (this.cinematic) {
      // Title screen: a slow orbit around the demo boat, lower and closer than in play.
      const a = time * 0.11;
      eye = [this.cam.x + Math.sin(a) * 12, 9.5, this.cam.z + Math.cos(a) * 12];
      target = [this.cam.x, 0.6, this.cam.z];
    }
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    // 48 degrees tall normally. On narrow (portrait) screens, widen it so you can still see
    // at least 44 degrees side to side, capped so it doesn't turn into a fish-eye.
    const minSide = (44 * Math.PI) / 180;
    const fovy = Math.min((80 * Math.PI) / 180, Math.max((48 * Math.PI) / 180, 2 * Math.atan(Math.tan(minSide / 2) / aspect)));
    const viewProj = multiply(perspective(fovy, aspect, 0.5, 120), lookAt(eye, target));

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(u.uViewProj, false, viewProj);
    gl.uniform1f(u.uTime, time);
    gl.uniform3fv(u.uCamPos, eye);
    gl.uniform3f(u.uAmbient, 0.012, 0.014, 0.026);
    const md = [-0.4, 1, 0.3];
    const ml = Math.hypot(...md);
    gl.uniform3f(u.uMoonDir, md[0] / ml, md[1] / ml, md[2] / ml);
    gl.uniform3f(u.uMoonColor, 0.022, 0.028, 0.05);

    const lights = game.lights().slice(0, MAX_LIGHTS);
    const calm = !this.settings.flashes; // reduced flashing: soften the flare's burst of light
    lights.forEach((l, i) => {
      this.lightPos.set(l.pos, i * 3);
      this.lightColor.set(calm && l.flare ? l.color.map((c) => c * 0.35) : l.color, i * 3);
      this.lightRadius[i] = l.radius;
    });
    gl.uniform1i(u.uLightCount, lights.length);
    gl.uniform3fv(u.uLightPos, this.lightPos);
    gl.uniform3fv(u.uLightColor, this.lightColor);
    gl.uniform1fv(u.uLightRadius, this.lightRadius);

    // Ray-traced shadows: buildings from the height grid, shadow creatures as soft spheres.
    const rt = this.raytracing;
    gl.uniform1i(u.uRayShadows, rt ? 1 : 0);
    const occ = rt ? game.creatures.slice(0, MAX_OCCLUDERS) : [];
    occ.forEach((c, i) => this.occluders.set([c.x, 0.9 + Math.sin(time * 3 + c.seed) * 0.25, c.z, 0.55], i * 4));
    gl.uniform1i(u.uOccluderCount, occ.length);
    gl.uniform4fv(u.uOccluders, this.occluders);
    gl.uniform1f(u.uFog, this.settings.fog && this.autoLevel < 2 ? 0.035 : 0);

    const m = this.meshes;
    const lh = game.lighthouse;
    this.updateBoatParts(game, time, dt);

    // Pass 1: the reflection. Draw the scene mirrored in the water plane (y = 0) into a
    // half-resolution texture. Mirroring is just a scale of -1 on y before the camera.
    const reflecting = this.settings.reflections && this.autoLevel < 1;
    if (reflecting) {
      const rt = this.reflectionTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));
      // Unbind last frame's reflection first: a texture can't be read and drawn into at once.
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
      gl.viewport(0, 0, rt.w, rt.h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(u.uViewProj, false, multiply(viewProj, MIRROR_Y));
      gl.uniform1i(u.uClip, 1);
      gl.uniform1i(u.uReflect, 0);
      this.drawObjects(game, time, b);
      gl.uniform1i(u.uClip, 0);
      gl.uniformMatrix4fv(u.uViewProj, false, viewProj);
    }

    // Pass 2: the real scene, into the post-processing buffer (or straight to the screen).
    if (this.postActive) this.post.begin(w, h);
    else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(u.uViewport, w, h);
    gl.uniform1i(u.uReflect, reflecting ? 1 : 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, reflecting ? this.reflection.tex : null);
    gl.activeTexture(gl.TEXTURE0);
    this.drawMesh(this.levelMeshes.water, IDENTITY, { water: true });
    gl.uniform1i(u.uReflect, 0);
    this.drawObjects(game, time, b);

    // Streaks slide along each current cell and loop, so the water looks like it flows.
    const cellSize = game.level.cell;
    for (const cc of this.currentCells) {
      const phase = (time * 0.9 + cc.seed) % 1;           // 0..1 across the cell
      const along = (phase - 0.5) * cellSize;
      const sideways = (cc.seed - 0.5) * cellSize * 0.6;
      const x = cc.x + cc.dir.x * along + cc.dir.z * sideways;
      const z = cc.z + cc.dir.z * along - cc.dir.x * sideways;
      const fade = Math.sin(phase * Math.PI);               // shrink at the cell edges so the loop doesn't pop
      this.drawMesh(m.streak, model(x, 0, z, cc.angle, fade, 1, fade), { glow: 0.6 });
    }

    this.updateWake(game, dt);
    for (const f of this.wake) {
      const k = f.life / WAKE_LIFE;            // 1 when new, 0 when gone
      // Foam spreads out, then shrinks away in its last third (there's no transparency to fade with).
      const size = (0.45 + (1 - k) * 0.9) * Math.min(1, k * 3);
      this.drawMesh(m.foam, model(f.x, 0, f.z, f.spin, size, 1, size), { glow: 0.3 + k * 0.7 });
    }

    // Particles last: they glow on top and don't hide anything behind them.
    this.emitAmbient(game, dt, playing || this.cinematic);
    this.particles.update(dt);
    const fwd = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    const right = norm(cross3(fwd, [0, 1, 0]));
    const up = cross3(right, fwd);
    const extras = [];
    if (game.strike) {
      // Lightning warning: a pulsing glow on the water where the strike will land.
      const k = 1 - game.strike.warn / 1.4;
      const pulse = 0.5 + 0.5 * Math.sin(time * 30);
      extras.push([game.strike.x, 0.35, game.strike.z, 0, 0, 0, 1.2 + 1.4 * k, 0.6, 0.75, 1.0, 0.15 + 0.35 * k * pulse]);
    }
    if (game.lighthouseActive) {
      // The lighthouse beam: a long, faint streak from the lamp to a spot sweeping over the water.
      const s = game.beamSpot;
      const lamp = [lh.x, 6.5, lh.z];
      const half = [(s.x - lamp[0]) / 2, (0.3 - lamp[1]) / 2, (s.z - lamp[2]) / 2];
      extras.push([lamp[0] + half[0], lamp[1] + half[1], lamp[2] + half[2], half[0], half[1], half[2], 1.1, 1.0, 0.9, 0.65, 0.09]);
      extras.push([s.x, 0.4, s.z, 0, 0, 0, 2.2, 1.0, 0.9, 0.6, 0.12]);
    }
    this.particles.draw(viewProj, right, up, extras);

    if (this.postActive) {
      this.post.end({
        time,
        hit: this.settings.flashes ? Math.min(1, game.hitFlash / 0.4) : 0,
        danger: playing ? Math.max(0, Math.min(1, (30 - game.oilPct) / 30)) : 0,
        fade: this.fade,
        bloom: 1,
      });
    }
  }

  // Everything that stands above the water. Drawn twice per frame: mirrored, then for real.
  drawObjects(game, time, b) {
    const m = this.meshes;
    const lh = game.lighthouse;
    this.drawMesh(this.levelMeshes.buildings, IDENTITY, { tex: [TEX.brick, TEX.roof, 0.5] });
    this.drawMesh(this.levelMeshes.props, IDENTITY, { tex: [TEX.wood, TEX.wood, 2.0] });
    this.drawMesh(m.lighthouse, model(lh.x, 0, lh.z), {
      glow: game.lighthouseActive ? 2.5 : 0.25, tex: [TEX.stone, TEX.stone, 1.5],
    });
    game.buoys.forEach((bu, i) => {
      const bob = Math.sin(time * 2 + i) * 0.06;
      this.drawMesh(bu.lit ? m.buoyOn : m.buoyOff, model(bu.x, bob, bu.z, Math.sin(time + i) * 0.1), {
        glow: bu.lit ? 2 * game.buoyStrength(bu) : 0.35 + 0.25 * Math.sin(time * 3 + i),
      });
    });
    for (const w of game.whirlpools) {
      const pulse = 1 + 0.05 * Math.sin(time * 3 + w.x);
      this.drawMesh(m.whirlpool, model(w.x, 0, w.z, -time * 2.4, pulse, 1, pulse), { glow: 1 });
    }
    game.shards.forEach((s, i) => {
      if (s.taken) return;
      this.drawMesh(m.shard, model(s.x, 0.75 + Math.sin(time * 2.5 + i) * 0.15, s.z, time * 1.8), { glow: 1.6 + 0.6 * Math.sin(time * 5 + i) });
    });
    game.oils.forEach((o, i) => {
      if (o.taken) return;
      this.drawMesh(m.oil, model(o.x, 0.35 + Math.sin(time * 3 + i) * 0.1, o.z, time * 1.5), { glow: 0.8 });
    });
    const bob = Math.sin(time * 2.2) * 0.08;
    const tilt = this.tilt || { roll: 0, pitch: 0 };
    const boatModel = multiply(multiply(model(b.x, bob, b.z, b.angle), pivotRotate(0, 0.2, 0, 'z', tilt.roll)), pivotRotate(0, 0.2, 0, 'x', tilt.pitch));
    this.drawMesh(m.boat, boatModel, { glow: 0.6 + 0.6 * (game.oilPct / 100), tex: [TEX.wood, TEX.wood, 2.0] });
    for (const p of this.boatParts || []) {
      this.drawMesh(p.mesh, multiply(boatModel, pivotRotate(p.pivot[0], p.pivot[1], p.pivot[2], p.axis, p.angle)), { glow: 0.8 });
    }
    for (const c of game.creatures) {
      const facing = Math.atan2(c.vx, c.vz);
      const stunned = c.stun > 0;
      const tint = stunned ? [2.5, 2.5, 3.5] : WHITE;
      const y = 0.9 + Math.sin(time * 3 + c.seed) * 0.25;
      const glow = stunned ? 0.3 : c.lunge > 0 ? 2.5 : 1.3;
      // Squash and stretch: breathe while hunting, stretch out in a lunge, wobble when stunned.
      let sx = 1, sy = 1 + Math.sin(time * 4 + c.seed) * 0.06, sz = 1;
      if (c.lunge > 0) { sx = 0.82; sy = 0.88; sz = 1.4; }
      else if (stunned) { const w = Math.sin(time * 22 + c.seed) * 0.08; sx = 1 + w; sz = 1 - w; }
      this.drawMesh(m.creature, model(c.x, y, c.z, facing, sx, sy, sz), { tint, glow });
    }
  }

  // A colour texture + depth buffer for the mirrored scene, rebuilt when the size changes.
  reflectionTarget(w, h) {
    const gl = this.gl;
    const r = this.reflection;
    if (r && r.w === w && r.h === h) return r;
    if (r) {
      gl.deleteFramebuffer(r.fbo);
      gl.deleteTexture(r.tex);
      gl.deleteRenderbuffer(r.depth);
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    this.reflection = { fbo, tex, depth, w, h };
    return this.reflection;
  }

  // Drop foam behind the boat while it moves; older flecks fade and spread.
  updateWake(game, dt) {
    for (const f of this.wake) f.life -= dt;
    this.wake = this.wake.filter((f) => f.life > 0);
    const b = game.boat;
    const speed = Math.hypot(b.vx, b.vz);
    this.wakeTimer -= dt;
    if (speed > 1.2 && this.wakeTimer <= 0 && !game.result) {
      this.wakeTimer = 0.09;
      const fx = Math.sin(b.angle), fz = Math.cos(b.angle);
      for (const side of [-1, 1]) {
        if (this.wake.length >= WAKE_MAX) this.wake.shift();
        this.wake.push({
          x: b.x - fx * 1.1 + fz * side * (0.3 + Math.random() * 0.25),
          z: b.z - fz * 1.1 - fx * side * (0.3 + Math.random() * 0.25),
          life: WAKE_LIFE * Math.min(1, speed / 6),
          spin: Math.random() * 3,
        });
      }
    }
  }

  // tex: [wall layer, roof layer, repeats per unit], or omitted for no texture.
  drawMesh(mesh, modelMatrix, { water = false, tint = WHITE, glow = 1, tex = NO_TEX } = {}) {
    const gl = this.gl;
    gl.uniform1i(this.u.uTexSide, tex[0]);
    gl.uniform1i(this.u.uTexTop, tex[1]);
    gl.uniform1f(this.u.uTexScale, tex[2]);
    gl.uniformMatrix4fv(this.u.uModel, false, modelMatrix);
    gl.uniform1i(this.u.uWater, water ? 1 : 0);
    gl.uniform3fv(this.u.uTint, tint);
    gl.uniform1f(this.u.uEmissiveBoost, glow);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
}
