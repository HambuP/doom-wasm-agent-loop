# Coder report — iteration 1

Role: coder. Task: implement the browser port per `artifacts/plan.md` (coder tasks 1–3, 5).
Implementation commit: `1888d9c` (parent `37dfee6`). Files committed: `platform/build.sh`,
`platform/doomgeneric_wasm.c`, `web/index.html`. Nothing in `tests/`, `loop/`, `assets/`
or `third_party/` was modified.

## Build

```sh
bash platform/build.sh        # emcc 4.0.18 required; sources ~/Developer/emsdk if emcc not on PATH
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

The script checks that emcc is exactly 4.0.18, then runs (and prints) one emcc command:
all `third_party/doomgeneric/*.c` + `platform/doomgeneric_wasm.c`, `-O2`,
`-sASYNCIFY=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=1MB`,
`-sEXPORTED_FUNCTIONS=_main,_doom_key_event`, `--preload-file assets/doom1.wad@/doom1.wad`,
output `dist/doom.js`, then copies `web/index.html` to `dist/`.
Output: `dist/index.html`, `doom.js` (79 KB), `doom.wasm` (539,314 B), `doom.data` (4,196,020 B).

## Design decisions (where the plan left a choice)

- **No SDL stub needed.** The plan predicted that `i_system.c` would need a stub `SDL.h`.
  It doesn't: every SDL include in the engine is guarded by `#ifdef ORIGCODE`, so the
  sources compile unchanged. `dummy.c` **is** compiled (contrary to the plan's
  "exclude dummy.c") because it defines `net_client_connected` and `drone`, which the
  linker needs. `mus2mid.c`'s `main` is under `#ifdef STANDALONE`, so it's harmless.
- **Sleep/timing:** `DG_SleepMs` calls `emscripten_sleep(ms)` (ASYNCIFY) instead of
  busy-waiting. This means the engine's wait loops (the wipe in `d_main.c`, tic sync in
  `d_loop.c`) yield to the browser, so the melt wipe animates and the page doesn't freeze.
  A busy-wait would have blocked the page for the whole wipe (~1 s) and the melt would
  never be shown. Cost: Asyncify instrumentation makes the wasm bigger and a bit slower.
- **Main loop:** `emscripten_set_main_loop(frame, 0, 1)` (rAF). `frame()` calls
  `doomgeneric_Tick()` only when a new 35 Hz tic is due (computed from `DG_GetTicksMs`),
  which avoids waiting inside `TryRunTics` on 60/120 Hz displays.
- **Pixels:** converted from BGRX to RGBA (alpha 255) in C into a static buffer, then
  copied with `putImageData` on the `#canvas` 2D context.
- **Input:** `web/index.html` maps `KeyboardEvent.code` to Doom key codes (arrows,
  Ctrl=fire, Space=use, Shift=run, Alt=strafe, Esc, Enter, Tab, Backspace, F1–F12,
  letters, digits, punctuation) and calls the exported `_doom_key_event`. The C side
  keeps a 64-entry ring buffer that drops events when full. Auto-repeat keydowns are
  suppressed, and every held key is released on window `blur`. `TranslateKey` in
  `i_input.c` is the identity function, so the codes go to the engine unchanged.
- **Test hooks:** `window.doomReady` (set on the first `DG_DrawFrame`) and
  `window.doomFrameCount` (incremented on every `DG_DrawFrame`). `DG_SetWindowTitle`
  sets `document.title` (observed: "DOOM Shareware").

## What was run (evidence)

| What | Revision | Result | Evidence |
|------|----------|--------|----------|
| `node tests/run_all.js --skip-build` | 37dfee6 + uncommitted port | ALL PASS | `artifacts/runs/coder-iter1-precommit-37dfee6/tests/results.json` |
| `bash platform/build.sh` | 1888d9c | exit 0 | `artifacts/runs/coder-iter1-1888d9c/logs/build.log` |
| `node tests/run_all.js` (full, with build) | 1888d9c | ALL PASS (T1–T8 + 7 self-tests) | `artifacts/runs/coder-iter1-1888d9c/tests/results.json`, `logs/run_all.log`, screenshots in `tests/` |
| Wipe/frame-pacing probe (my scratch script, not a protected check) | 1888d9c | max rAF gap 18 ms over 12 s (includes title→demo wipe); 422 frames/12 s ≈ 35 fps | `artifacts/runs/coder-iter1-1888d9c/probe/` (`wipe_probe.js`, `wipe_probe_output.txt`, `wipe-mid-melt.png`) |

Key metrics at 1888d9c: T3 ready in 59 ms, 106 frames/3 s; T4 113 distinct colors,
0 bad-alpha pixels; T5 menuDiff 0.94, levelDiff 0.98; T6 walk 0.30 / turn 0.40 / ammo
region 0.14; T7 60 s random input, 0 page errors, 105 frames in the final 3 s.

Results report the tree as `dirty`. That comes from files I don't own: the tester's
untracked `tests/run_all.js`, `tests/play.js`, the modified `tests/CRITERIA.md`,
`package*.json`, `artifacts/plan.md`, and `artifacts/runs/`. The port files themselves
are all committed in 1888d9c.

Visual check (a red/blue swap would still pass T4): `t3-first-frame.png` shows the
title screen with correct colors (red background, gold logo, green marine), and
`t5-level.png` shows E1M1 with blue water and red status-bar digits. Colors look correct.

## Known gaps / risks

- **No sound or music.** `FEATURE_SOUND` is off (planned as a stretch goal).
- **No mouse.** Keyboard only.
- **No persistence.** Config (`.default.cfg`) and savegames (`./.savegame/`) are written
  to MEMFS and lost on reload (no IDBFS).
- **Quit isn't handled cleanly.** Menu Quit → `I_Quit` → `exit()` stops the main loop
  and leaves the last frame on screen. I haven't tested this or shown a message for it.
- **T1 size margin is small.** `doom.wasm` is 539 KB against the 500 KB threshold.
  Switching to `-Oz` or dropping ASYNCIFY could shrink it below that line without
  breaking anything.
- **Asyncify reentrancy.** A key event that arrives during `emscripten_sleep` only
  touches the ring buffer and never re-enters the engine, so this is safe today. Any
  future JS→C call that runs engine code must not happen while the engine is sleeping.
- **Browsers.** Only headless Chromium (Playwright) was exercised. Firefox and Safari
  are untested.
- `-Wno-everything` hides engine warnings so the build log stays readable.

## Next action

Reviewer: review commit 1888d9c (`git show 1888d9c`). Then the verifier/player runs
`node tests/run_all.js` and `node tests/play.js` independently on that revision.
