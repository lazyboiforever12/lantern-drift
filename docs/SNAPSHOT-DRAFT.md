# Snapshot drafts (for you to post on Mipmap, one per day)

Each Snapshot adds 1% to the Mips for all your shipped projects. You need 15 new tracked minutes
on the project before each one, and you can post once per day.
How to post: Mipmap dashboard → Snapshots box → upload the image, choose your public username
(not your real name), paste the caption, Send.

## Snapshot 1 (post today)
**Image:** `docs/snapshot-currents.png`

> Lantern Drift now has 5 levels! The last two add currents, water that carries your boat, shown by drifting streaks. Also new: a foam wake behind the boat, saved progress with best times and a level select, plus gamepad and touch controls. I tuned the difficulty with two play-test bots that play every level 40 times, so each level is a bit harder than the last. Raw WebGL2, no engine. (Built with help from Claude Code.)

## Snapshot 2 (post tomorrow)
**Image:** `docs/snapshot-effects.png`

> Graphics upgrade for Lantern Drift: procedural brick, roof and wood textures (a WebGL2 texture array with mipmaps and anisotropic filtering, triplanar-mapped so no UVs needed) and planar water reflections, so lit windows shimmer in the flood. The scene renders offscreen with 4x MSAA, then a bloom pass (bright-pass + separable Gaussian blur at quarter resolution), vignette, film grain, a colour split when you're hit, and a cold desaturated look when your oil runs low. Added instanced particles too (rain, flare sparks, lantern embers, shadow wisps) and a sweeping lighthouse beam. Plus generative music that gets tenser when shadows are near, and a settings menu. Still raw WebGL2, all shaders by hand. (Built with help from Claude Code.)

---

# Devlog

## 9 Nov 2026 (evening)
- Built the first playable version: raw WebGL2 renderer, lantern lighting, wavy water, boat physics, oil, buoys, shadows, flares, lighthouse goal, 3 levels, generated sound.
- Wrote a headless play-test bot (`tools/autoplay.mjs`). First result: every level won with 80 to 95% oil left, so everything was far too easy.
- Retuned: shadows now lunge faster than the boat can row (9 vs 7.5), lunge more often, and hover closer. Oil drains faster.
  Sloppy-bot win rates are now about 100% / 98% / 75% / 70% / 55% for levels 1 to 5.
- The boat now starts facing open water (it used to face a wall).
- Added: foam wake, saved progress and best times, level select, run timer, pause button, gamepad and touch controls.
- Added levels 4 (The Canals) and 5 (Lighthouse Point) with a new mechanic: currents.
- Found and fixed buildings hiding the boat in narrow channels (lower buildings, steeper camera).
- Added `tools/checklevels.mjs` (map checker) and an F9 screenshot key on the local server.

## 9 Nov 2026 (late)
- Post-processing pipeline (`src/post.js`): multisampled offscreen framebuffer → resolve → bright-pass/downsample → 2× separable Gaussian blur → composite (bloom, vignette, grain, hit colour split, low-oil grading, fade-in). Falls back to direct rendering if unsupported.
- Instanced particle system (`src/particles.js`): one draw call for up to 1500 particles, with billboards and velocity-stretched streaks, plus additive blending. Used for rain, flare sparks, pickups, buoys lighting up, the lighthouse waking, lantern embers and shadow wisps.
- Sweeping lighthouse beam with a moving spot light on the water.
- Screen shake on hits, lunges and bumps.
- Generative music: chord pad, a pentatonic melody with echo, and a heartbeat that rises with danger.
- Settings menu (effects, shake, rain, sound and music volume, frame rate), saved in the browser.
- First-time tips on level 1.
- Fixed: the water plane ended too close to the map corners, and the awake lighthouse over-lit its surroundings.
- Procedural textures (brick, roof tiles, wood, stone) in a WebGL2 texture array with mipmaps and anisotropic filtering, using triplanar mapping (no UVs needed).
- Planar water reflections: the scene is rendered mirrored into a half-res texture, and the water samples it with ripple distortion and Fresnel.
- Published to GitHub Pages; Repo and Demo links added on Mipmap; Snapshot 1 posted.

## 10 Nov 2026 (early hours)
- README now has an AI disclosure section.
- New level, Ember Bay, with a new mechanic: lit buoys burn out after 40 s, so you must light them all in one well-planned run. It's level 5, and Lighthouse Point stays the finale. Tuned with the play-test bots (about 53% for the sloppy bot).
- Automatic quality scaling: if frames stay below about 45 fps, it drops reflections, then bloom, then resolution.
- Accessibility: a "Flashing effects" switch removes the hit flash and colour split and softens the flare light.
- 13 automated rule tests (`node --test tests/game.test.mjs`); `package.json` scripts for start / test / check / playtest.
- The Storm (new level 6): wind turns and gusts, pushing the boat; lightning warns with a glow, then strikes. It stuns shadows nearby but costs oil if you're under it. Uses a seeded random so tests are repeatable.
- Ending: after Lighthouse Point, fireworks over the harbour, rolling credits, and a full-run timer with a saved best.
- Level editor: paint 32×16 maps, live fairness checks (the same `checkLevel` the CLI uses), play instantly, and share by link (run-length-encoded, base64 code in the URL hash).
- Phone: the field of view widens in portrait, plus touch control hints and a HUD that fits small screens.
- 16 tests now (added share codes, the level checker and lightning).
