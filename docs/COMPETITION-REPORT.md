# Hack Club Mipmap: who else is building, and how Lantern Drift compares
Research date: 9 Nov 2026 (night). Sources: the public Snapshot feed on the Mipmap dashboard, GitHub search,
Hack Club's official Mipmap YouTube series, and competitors' public repos.
Not covered: Hack Club Slack #mipmap (you weren't signed in), Reddit (it blocks automated search), TikTok and Instagram (nothing found / not searched).

## First: how Mipmap actually "scores"
There is no leaderboard or single winner. Each shipped project is **reviewed**. If it's approved you get
**15–25 Mips per tracked Hackatime hour** (higher tier pays more), plus +1% per Snapshot. Then you spend Mips on prizes.
So "winning" means:
1. **Getting approved.** That means a working game, no engine, the right tier, honest hours, and not vibecoded.
2. **Having as many real tracked hours as possible** on the linked Hackatime project.
3. **Tier Romeo** pays more than Quebec. Sierra pays the most.
4. **Posting Snapshots regularly** (1% each, once a day).

Community-wide, the "Steve's in trouble!" challenge showed only **81 / 600 approved hours** across everyone.
Very few hours have been approved so far, so the field is small and early.

## What everyone else is building

| Who / repo | What it is | Tech / tier | How far along |
|---|---|---|---|
| bodergob373 (Jelly-Car-3D) | 3D game with its own software rasteriser on a canvas | JS, software renderer (Sierra-style) | Early: projection, triangles, camera, barycentric coords |
| NotTacos | Vulkan project | C/C++, Vulkan (Sierra) | Very early: window, instance, device, swap chain |
| TheAsherBot (WindowsGameEngine) | Own engine plus game | C++, DirectX 12 (Sierra) | Early: renderer class, "background colour working" |
| EvelynMakesThings | 3D game | C/C++, likely OpenGL (Romeo) | Strongest technically: model loading, mipmapping, ImGui, depth buffer, images |
| MathInfo | Software 3D renderer | Unknown | Early: drawing walls, colour bugs, slow quads |
| "D3D11 Game" | 3D game | DirectX 11 (Romeo) | Has ambient sound |
| vindognz (pong) | Pong | C | Paddles, ball, collisions |
| CrownSheep | Minesweeper remake | C# MonoGame (Quebec) | Remake of an older project |
| Tom | Small game | Unknown | Added pause |
| rainbow shooter | First Python game, shooter | Python/Pygame (Quebec) | Just started |
| stilk | First triangle | Unknown | "No way I can finish the game" |
| Ramsey | Refactoring | Unknown | Code organisation |
| hardik19april-eng (Highway Rush) | 2D endless car dodger | JS canvas (Quebec) | Complete small game, playable on GitHub Pages |
| VGokulsai (Hyderabad Traffic) | 2D scooter traffic dodger | JS canvas (Quebec) | Small complete game |
| PBDeveloping1 (Beyond The Crest) | Rally driving game | JS (8 KB so far) | Mostly a plan in the README |
| BaldSeb (Fancy raycast game) | Wolfenstein-style raycaster | JS canvas | README only so far |
| Joecodeee (Tetris) | Tetris | (2 KB) | Almost empty |
| TVAK17 (HackClub-MipMap) | Unknown | Python (3 KB) | Almost empty |
| ezxd1148 (EZXD-Engine) | Own engine | Zig | Early |
| juan504n (spyro-game) | Huge PS1-style Spyro fan game | **three.js** | Very big, but three.js is a scene library (not allowed in Romeo) and it's a fan game of an existing franchise, so it's at risk in review |

### Patterns
- **Most entries are early.** "First triangle", "swap chain works", "background colour works".
- **The hard-mode crowd (Sierra)** builds Vulkan, DX12 or software renderers in C++. Impressive tech, but few have a game yet.
- **The Quebec crowd** makes small 2D canvas games: car dodgers, Pong, Tetris, shooters.
- **The best Romeo entry visible** (EvelynMakesThings) shows model loading, **mipmapping**, an ImGui debug UI and textures.
- Almost nobody has: a finished multi-level game, menus, settings, saving, music, controller support and a live demo link all at once.

## How Lantern Drift compares
**Strengths (clearly above most entries):**
- A complete, finished game: 5 levels, a goal, failure, a difficulty curve, title, pause, settings, save and best times.
- Live in the browser via GitHub Pages, so reviewers can play instantly. Most others need building from source.
- A real graphics pipeline for Romeo: multi-light shader, MSAA, bloom post-processing, instanced particles, vertex-shader waves.
- Generative music and sound with no audio files. Keyboard, gamepad and touch.
- A tidy repo: README with a techniques section, dev tools, play-test bots.

**Weaknesses and risks (being honest):**
1. **Tiny tracked time: about 1 hour.** Pay is per hour, so 1 hour ≈ 15–25 Mips however good the game is.
   A polished game with only 1 hour logged can also look like vibecoding to a reviewer. **This is the biggest issue.**
2. **AI-built.** Mipmap allows AI, but AI time counts about a third less, and retyping a whole LLM project isn't allowed.
   Reviewers reward people who understand their code. The captions disclose Claude Code, which keeps you honest.
3. ~~Missing two techniques the official tutorials teach: textures/mipmaps and mirrors.~~ **Done 9 Nov:** procedural textures in a texture array with mipmaps and anisotropic filtering, plus planar water reflections.

## What to do to stand out (in order)
1. **Put in real hours yourself, tracked by Hackatime.** Open the project in VS Code (Hackatime extension) and:
   - Read and tweak code: change colours, write a 6th level in `src/levels.js`, tune difficulty.
   - Ask an AI to *explain* parts (allowed and encouraged) instead of writing them.
   - Every real hour = more Mips and a more convincing review.
2. **Post a Snapshot every day** you work (+1% each).
3. **Ship by Fri 13 Nov.** Mention in your ship notes what *you* did and what AI helped with.
4. **Be ready to explain:** how the lantern light works (point lights in the fragment shader), what bloom is, how the levels are stored.
