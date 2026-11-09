# Lantern Drift

Steer a small lantern boat through a dark, flooded town. Your light keeps shadow creatures away.
Collect oil, light the buoys, and reach the lighthouse before your lantern goes out.

Made for [Hack Club Mipmap](https://mipmap.hackclub.com/) (Tier Romeo: raw WebGL2, no engine).

![The boat riding a current on Lighthouse Point](docs/snapshot-currents.png)

## Controls
| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Steer | A / D or ← / → | Left stick or d-pad | ◀ ▶ buttons |
| Row forward / back | W / S or ↑ / ↓ | Stick up / down, or RT / LT | ▲ button |
| Flare | Space | A | ✦ button |
| Pause | P or Esc | Start | II button |
| Restart level | R | | |
| Back to title (when paused) | Q | B | |
| Settings (title or pause) | O | Y | tap "O settings" |
| Mute | M | | |
| Frame rate counter | F3 | | |

On the title screen, press a number (or click a level) to replay any level you've unlocked.

## How to play
- Your oil drains over time, and your light shrinks as it runs low. Collect oil cans.
- Sail past every buoy to light it. Lit buoys are safe zones that shadows won't enter.
- Shadows lunge at you and steal oil. A flare knocks them back.
- Once every buoy is lit, the lighthouse wakes up. Reach it to clear the level.
- Later levels have currents: water that carries your boat along. Ride them, or row hard against them.
- Your progress and best time for each level are saved in the browser.

## Levels
1. The Flooded Market
2. Lantern Row
3. The Old Harbour
4. The Canals (currents)
5. Lighthouse Point

## Run it
Needs [Node.js](https://nodejs.org/) (no packages to install):
```
node serve.mjs
```
Then open http://localhost:5173

## Graphics techniques (Tier Romeo)
WebGL2 is only used to talk to the GPU. Everything below is written in this repo:
- **Lighting:** one hand-written GLSL shader with up to 16 point lights (lantern, flares, buoys, lighthouse, beam spot), Blinn-Phong specular, a faint moon, emissive surfaces, and Reinhard tone mapping with gamma.
- **Water:** a grid mesh displaced in the vertex shader by three sine waves, with the matching analytic normal so lights glint on the waves.
- **Post-processing** (`src/post.js`): the scene is drawn into a 4× multisampled renderbuffer, resolved with `blitFramebuffer`, then bright-passed and downsampled to quarter resolution and blurred with a separable 9-tap Gaussian (linear-sampling trick, two iterations) for bloom. A composite pass adds a vignette, film grain, a chromatic split on hits, low-oil colour grading and fade-ins. The full-screen triangle is generated from `gl_VertexID`, with no vertex buffer.
- **Instanced particles** (`src/particles.js`): up to 1500 particles in one `drawArraysInstanced` call, with per-instance attributes (`vertexAttribDivisor`), camera-facing billboards or velocity-stretched streaks, and additive blending with depth writes off.
- **Meshes:** all models are built from boxes in code (`src/meshes.js`), and each level's buildings are baked into one static vertex buffer.
- **Maths:** hand-written perspective, look-at and model matrices (`src/math.js`).
- **Fallback:** if offscreen rendering isn't supported, the game draws straight to the screen, and "Glow and colour effects" can be switched off in Settings.

## How it's made
- Plain JavaScript modules and raw WebGL2: no engine, no three.js.
- `src/gl.js`: shader compiling and vertex buffers
- `src/math.js`: hand-written matrix maths (perspective, look-at, model matrices)
- `src/shaders.js`: one GLSL shader with wavy water and up to 16 point lights
- `src/meshes.js`: low-poly models built from boxes in code
- `src/game.js`: boat physics, currents, collisions, oil, buoys and creature behaviour
- `src/render.js`: camera, drawing, the boat's foam wake and current streaks
- `src/levels.js`: the five level maps, drawn as text
- `src/main.js`: game states, HUD, saving, keyboard / gamepad / touch input
- `src/post.js`: post-processing (MSAA resolve, bloom, colour grading)
- `src/particles.js`: instanced particle system
- `src/audio.js`: all sounds and the generative music, made live with the Web Audio API (no sound files)

### Dev tools
- `node tools/checklevels.mjs` checks every map: closed walls, and that every buoy, oil can and lighthouse can be reached.
- `node tools/autoplay.mjs` has two bots (a "good" one and a "sloppy" one) play every level many times
  and prints win rates, time and oil left. It was used to tune difficulty so each level is a bit harder than the last.
- Press F9 while running `node serve.mjs` to save a screenshot into `screenshots/`.
- In the browser console, `lanternDrift.step(2)` runs two seconds of game time and `lanternDrift.game` is the current level.

## Progress
- [x] WebGL2 renderer, camera, wavy water, lantern and buoy lighting
- [x] Boat steering with keel-style drag and building collisions
- [x] Oil, buoys, lighthouse goal, shadow creatures, flares
- [x] Title / pause / game over / win screens, generated sound
- [x] Difficulty tuning with play-test bots
- [x] Saved progress, best times, level select
- [x] Boat wake, gamepad and touch controls
- [x] Levels 4 and 5 with currents
- [x] Bloom post-processing, instanced particles, lighthouse beam, screen shake
- [x] Generative music, settings menu, first-time tips
- [ ] Play-testing by real people
- [ ] Publish (GitHub Pages) and ship on Mipmap
