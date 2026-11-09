# Lantern Drift: rules for AI helpers

This project is for Hack Club Mipmap, Tier Romeo (no game engine).

## Tech rules
- Plain JavaScript (ES modules) and raw **WebGL2** only. Write shaders by hand.
- No game engines or scene libraries: no three.js, Babylon, PixiJS, Phaser, PlayCanvas, regl.
  WebGL must only talk to the GPU; lighting, cameras and maths are written in this repo.
- A tiny hand-written maths file (vec3/mat4) is fine. No npm runtime dependencies.
- Must run well on Intel Iris Xe: low-poly meshes, one lighting pass, 60 fps target.
- Runs through the bundled local server: `node serve.mjs`, then http://localhost:5173

## Originality
- Original game. No names, maps, models, sounds or logos from Valve, Counter-Strike or any other existing game.

## How to help (Mipmap AI rules)
- Mipmap allows AI, but AI time earns fewer Mips and copying a whole AI-written project is not allowed.
- Work in small steps: one feature per request, keeping the game playable after each step.
- Explain what new code does and why, so the developer understands it and can write parts by hand.
- When the developer asks to write something themselves, give hints and review, not the full code.
