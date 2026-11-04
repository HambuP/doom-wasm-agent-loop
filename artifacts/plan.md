# Plan — iteration 1 of 5: port DOOM to the browser

Source revision at planning time: 37dfee6 (+ untracked package.json/package-lock.json, playwright dep).
Prior feedback: none (first iteration). No artifacts/state.json existed; root should create it.
Toolchain: emcc 4.0.18 (emsdk at ~/Developer/emsdk), node + Playwright available.

## Findings from reading the code
- `platform/doomgeneric_wasm.c` has empty callbacks, no `main()`. `web/index.html` has a 640x400 canvas, loads nothing.
- Engine files: `third_party/doomgeneric/*.c`; `dummy.c` and the `doomgeneric.c` driver exist. Platform ports (xlib/sdl/etc.) are removed.
- `i_system.c` does `#include "SDL.h"` and calls `SDL_Quit()`. third_party is read-only, so the coder must supply a
  stub `SDL.h` (and any other missing SDL header, e.g. SDL_mixer if sound is enabled) under `platform/`
  (add `-Iplatform/include`) or use `-sUSE_SDL=2` (needs a network port download; prefer the stub).
- Pixels are 0x00RRGGBB in a uint32 (bytes B,G,R,0 in memory). Must convert to RGBA with alpha=255 before `putImageData`.
- Timing: `I_GetTime` -> `DG_GetTicksMs`; `I_Sleep` -> `DG_SleepMs`. Busy-wait loops exist in `d_main.c` (wipe, ~l.311-319)
  and `d_loop.c` (tic sync). They spin on the clock waiting for time to pass.
- WAD must be reachable via the engine's file I/O; use `-iwad doom1.wad` arg or preload.
- Mouse events are commented out in `i_input.c` (keyboard only is acceptable this iteration).

## Coder tasks (platform/, web/ only; commit only those)
1. `platform/build.sh`: emcc build of all engine sources actually needed (exclude dummy.c and any file with its own main/SDL deps),
   `-I third_party/doomgeneric -I platform/include`, `--preload-file assets/doom1.wad@/doom1.wad`, output `dist/index.html`+`doom.js/.wasm/.data`
   (copy `web/index.html` to dist). Exported runtime: `callMain`/`ccall`, memory view. Print the exact command in the script. Pin emcc 4.0.18 check.
2. `platform/doomgeneric_wasm.c`:
   - `DG_GetTicksMs` via `emscripten_get_now()`.
   - `DG_SleepMs`: must not hang. Busy-wait the remaining time (or no-op) since tick loops compare against the clock; document choice.
     Verify wipe and tic sync terminate in a browser.
   - `main()`: `doomgeneric_Create(argc, argv)` with args `-iwad /doom1.wad`, then `emscripten_set_main_loop(tick, 0, 1)` calling `doomgeneric_Tick()`
     once per animation frame (no infinite loop).
   - `DG_DrawFrame`: convert `DG_ScreenBuffer` BGRX->RGBA (alpha 255) and draw to the canvas (EM_ASM/JS glue, or expose the buffer pointer to JS).
   - `DG_GetKey`: ring buffer fed by JS keydown/keyup; map to Doom keys (arrows, Ctrl fire, Space use, Shift run, Enter, Esc, Tab, Y/N, 1-7, letters).
   - `DG_SetWindowTitle`: set `document.title`.
3. `web/index.html` (+ optional js): canvas id `canvas`, loads `doom.js`, preventDefault on game keys, focus canvas on click.
   Expose test hooks: `window.doomReady` (true after first drawn frame), `window.doomFrameCount`.
   Keep `Module.canvas` bound so Playwright can read pixels from `#canvas`.
4. Stretch (only after the above works): sound effects via Web Audio; mouse; config/save persistence (IDBFS). Not required this iteration.
5. Write `artifacts/coder_report.md`: build command, files changed, what was run, known gaps, source commit hash.

## Tester tasks (tests/ and artifacts/ only; runs once)
Fill in `tests/CRITERIA.md` (currently empty) with measurable criteria, then implement them.
Entry point `tests/run_all.js` (exit nonzero on any failure; print per-check PASS/FAIL; write JSON results with git hash).
Serve `dist/` on 127.0.0.1 and drive with Playwright (chromium). Specific checks:
- T1 build: `platform/build.sh` exits 0; `dist/` has index.html, doom.js, doom.wasm, doom.data; wasm size > 500KB.
- T2 serve: `.wasm` served as `application/wasm`; no console errors / failed requests / pageerrors during 10 s.
- T3 boots: `doomReady` within 30 s; frame counter keeps increasing (>= 20 frames in 3 s).
- T4 pixels: canvas not blank; contains >= N distinct colors; alpha is 255 everywhere (catches BGRX bug); title screen/menu differs from first frame.
- T5 input: press Enter/Esc/arrows -> menu appears (screen changes, pixel diff over threshold); start New Game (Enter, Enter, Enter) -> in-level frame differs from menu.
- T6 gameplay: hold ArrowUp 2 s -> view changes; Ctrl fires (status bar ammo region changes) ; turning with ArrowLeft changes frame.
- T7 stability: 60 s of random key input with no crash/pageerror and frame counter still advancing (no freeze at screen wipe).
- T8 WAD integrity: game loads from packaged shareware WAD (no network fetch of external WADs).
- Each check must also have a negative control where practical (e.g. blank canvas fails T4) — document in CRITERIA.md.
Also write `tests/play.js`: Playwright script that starts a new game, walks/turns/fires, opens the menu, saves numbered screenshots to
`artifacts/runs/<run-id>/screenshots/` (run-id passed via env or arg). Document limits of the checks in CRITERIA.md
(pixel heuristics can't prove faithful rendering, sound untested, no human judgment of feel).

## Verification order / handoff
architect(this) -> tester (this iteration only) -> coder -> reviewer -> verifier -> player.
Coder must not touch tests/. Tester must not touch platform/ or web/.

## Known risks to watch for
- Missing `SDL.h` compile error; undefined `DG_ScreenBuffer` usage; infinite loops in wipe (clock must advance, sleep must not block forever).
- WAD path mismatch (preload path vs `-iwad`). Memory growth: use `-sALLOW_MEMORY_GROWTH=1`.
- Pixel format shows wrong colors (red/blue swapped) or transparent canvas.
- Keys stuck if keyup is lost on blur: release all keys on window blur.

## Stopping/next action
After this iteration the root records failing tests in artifacts/state.json. Next action: tester writes tests, then coder implements.
