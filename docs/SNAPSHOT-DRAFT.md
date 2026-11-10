# Snapshot drafts (for you to post on Mipmap, one per day)

Each Snapshot adds 1% to the Mips for all your shipped projects. You need 15 new tracked minutes
on the project before each one, and you can post once per day.
How to post: Mipmap dashboard → Snapshots box → upload the image, choose your public username
(not your real name), paste the caption, Send.

## Snapshot 1 (post today)
**Image:** `docs/snapshot-currents.png`

> Lantern Drift now has 5 levels! The last two add currents, water that carries your boat, shown by drifting streaks. Also new: a foam wake behind the boat, saved progress with best times and a level select, plus gamepad and touch controls. I tuned the difficulty with two play-test bots that play every level 40 times, so each level is a bit harder than the last. Raw WebGL2, no engine. (Built with help from Claude Code.)

## Snapshot 2 (can be sent from 3:25 PM on 10 Nov)
**Image:** `docs/snapshot-boatyard.png` (the aircraft carrier in the new Boatyard, with its patrol plane circling)

> Huge Lantern Drift update: a Boatyard! Earn Embers by clearing levels and spend them on 22 boats, from a bed mattress and a comfy couch up to the Titanic, an aircraft carrier and an old battleship. Each has its own stats and a special trait (the sub hides from shadows, the carrier's plane lights buoys from further away, the battleship's armour halves stolen oil), upgrades, 17 paints, and animated parts: radars, propellers, turrets, paddle wheels and funnel smoke. Also new: a storm level, a level editor with share links, an ending with fireworks, and shadows that can't pass through walls any more (they path around buildings with a flow field). Raw WebGL2, no engine. (Built with Claude Code, directed by me.)

## Snapshot 3 (can be sent from 7:58 AM on 11 Nov)
**Image:** `docs/snapshot-raytraced.png` (a flare over Lantern Row: every building throws a ray-traced shadow)
Mipmap captions are limited to 500 characters; this one is 446.

> Ray tracing in raw WebGL2! Every light now casts real shadows: the shader walks each light ray through the town's building grid cell by cell (a 2D DDA), so flares throw long shadows down every street, and shadow creatures cast soft ones. Plus volumetric mist, 1080p/1440p/4K and 30-240/uncapped frame rates, a Daily Voyage (a new generated town every day, with streaks) and Endless mode. Still no engine. (Built with Claude Code, directed by me.)

## Snapshot 4 (from 7:58 AM on 12 Nov, or 24 hours after Snapshot 3)
**Image:** `docs/snapshot-photomode.png` (photo mode in The Storm)
Caption: 473 characters.

> Lantern Drift keeps growing: a photo mode (this shot), towns full of detail (roofs, chimneys, lit windows, piers, lamp posts), whirlpools that swallow shadows, ember shards to hunt, 25 achievements, and a title screen where a bot sails the levels live behind the menu. The boat now leans into turns and shadows stretch when they lunge. Plus wall foam and ambient occlusion from the same grid the ray-traced shadows use. Raw WebGL2. (Built with Claude Code, directed by me.)

## Snapshot 5 (spare, needs shortening to 500 characters before posting)
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
- Shadows no longer pass through buildings: they collide like the boat and find their way with a flow field (a BFS distance map to the boat, refreshed 4× a second). They only lunge with a clear line of sight. Tested: no shadow ever ends up inside a wall.
- Boatyard (idea from lazyboiforever12): Embers currency from clears (first clears, oil left, best times, full runs), 11 boat designs with real stat differences, 4 upgrades × 3 levels per boat, 17 hull/trim paints including glow paints, and a live 3D preview using the game's renderer.
- 18 tests.

## 10 Nov 2026 (evening)
- Snapshot 2 posted (the Boatyard). Mipmap captions are capped at 500 characters, so it was shortened.
- Ray-traced shadows: building heights go into an R32F texture; the fragment shader traces a shadow ray per light
  through the grid with a 2D DDA and soft penumbrae; shadow creatures are traced as soft spheres.
  Early-outs (skip faint lights, stop above the tallest roof) brought the cost down to about 1 ms a frame here.
- Volumetric light: closed-form in-scattering for the three brightest lights (lantern, flare, lighthouse).
- Resolution presets (Auto, Native, 1080p, 1440p, 4K) and frame-rate limits (match screen, 30, 60, 120, 144, 240,
  uncapped). The uncapped loop first ran at 576 "fps" by queueing frames the GPU hadn't drawn; a GPU fence fixed it
  (103 real fps here with everything on).
- Procedural voyages (`src/voyages.js`): seeded maps checked by `checkLevel`, a Daily Voyage with streaks, and an
  Endless mode. Bot-tested across depths 0 to 11.
- 23 tests.
- Level editor v2: Brush / Box / Fill tools, Mirror, undo and redo, level name, difficulty (Calm to Nightmare) and
  twist saved in share links (old links still load), a Random button using the voyage generator, a step-by-step
  guide, and live balance tips. 25 tests.
- Town detail: each building cell gets a pitched or flat roof, maybe a chimney, and framed windows (lit or dark) on
  every side facing water; a props mesh adds piers, moored rowboats, mooring posts, lamp posts and floating crates.
- 23 achievements with Embers rewards, toasts and an achievements screen.
- Fixed a save bug: loading kept only level progress, so Embers, boats and tips were lost on every reload.
- 27 tests.
- Wall foam and ambient occlusion from the building grid (the foam hides the reflection, like real foam).
- Whirlpools (pull, swirl, spit you out for oil; stun shadows dragged in) and ember shards (optional Embers),
  in the editor, generated voyages (whirlpools from voyage 3) and three shards in every story level.
  Bot-tested: no stuck runs. 30 tests.
- Live title screen: the play-test bot moved into `src/autopilot.js` and now sails the story levels behind the
  menu with a slow orbiting camera (visual only: no sound, Embers or achievements).
- Game feel: the hull rolls into turns and pitches with acceleration; shadows squash and stretch; the camera leads.
- Photo mode (C): frozen action, free orbit camera, F9 to save.
