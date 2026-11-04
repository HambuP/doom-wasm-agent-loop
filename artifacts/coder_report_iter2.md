# Coder report — iteration 2 (review fixes for 1888d9c)

Role: coder. Task: address `artifacts/review-iter1-1888d9c.md` — tick guard (#1), limit
ASYNCIFY (#2), scope warnings (#3), key handling (#4), quit path (#5) — and commit the tests.

## Commits

| Commit | What |
|--------|------|
| `0436262` | Tester's `tests/CRITERIA.md`, `tests/run_all.js`, `tests/play.js` committed **unchanged**, plus `package.json`/`package-lock.json` (Playwright). Pins the checks to a revision. |
| `052978a` | Port fixes: tick guard, quit handler, scoped warnings, `ASYNCIFY_IGNORE_INDIRECT`, canvas-scoped keys. **Regressed** (see below). |
| `62b1bcd` | `-sASYNCIFY_ADD=dynCall_v`, which fixes the regression. **Revision under test.** |

Files changed by the coder: `platform/doomgeneric_wasm.c`, `platform/build.sh`, `web/index.html`.
I did not modify anything in `tests/`, `loop/`, `assets/` or `third_party/`.

## Findings → actions

1. **Tick re-entry (#1).** Emscripten pauses the main loop while Asyncify is suspended
   (`emsdk/upstream/emscripten/src/lib/libasync.js`: `MainLoop.pause()` on unwind, `MainLoop.resume()` on
   rewind), so re-entry is not expected. `frame()` now has an `in_tick` guard: on re-entry it returns,
   logs to stderr, and sets `window.doomTickReentries`. Observed: `doomTickReentries = 0` in all probes
   (including the wipe into E1M1 and the Asyncify-assertions build).
2. **ASYNCIFY scope (#2).** `-sASYNCIFY_IGNORE_INDIRECT=1 -sASYNCIFY_ADD=dynCall_v`. Instrumented functions
   (`ASYNCIFY_ADVISE=1 bash platform/build.sh`): `dynCall_v, frame, main, TryRunTics, D_Display`
   (`I_Sleep`/`DG_SleepMs`/`doomgeneric_Tick` are inlined). Before this change every function was instrumented.
   Log: `artifacts/runs/coder-iter2-review-fixes/logs/build-advise-dyncall.log`.
   wasm: 539,314 B → **382,276 B**.
3. **Warnings (#3).** The engine compiles with `-Wno-everything` and `platform/doomgeneric_wasm.c` with
   `-Wall -Wextra` (0 warnings), then the objects are linked. Objects go to `build/obj/`.
4. **Keys (#4).** The listeners are now on `#canvas`, so they only act while the canvas has focus. F5/F11/F12,
   any Meta combo, and Ctrl+letter/punctuation go to the browser. Ctrl+arrows/space/shift/alt/esc/enter/digits
   still go to the game, because Ctrl is fire. Keyup always releases keys the game saw pressed, and every
   key is released on canvas blur and on window blur.
5. **Quit (#5).** `I_Quit` in this engine does **not** call `exit()` (it is `#if ORIGCODE`), and `I_Error`
   calls `exit(-1)`, which does not stop the main loop. An `I_AtExit(on_engine_exit, true)` handler
   (registered both before and after `doomgeneric_Create`) cancels the main loop and sets
   `window.doomExited`. It also calls `Module.onDoomExit`, which shows "DOOM has exited. Reload the page to
   play again." `Module.onExit` is also set.
   Minor: the comment says TICRATE must match `doomdef.h`.

Not addressed (unchanged from the review): #6 aspect ratio, #7 sound and mouse, and the minor items
(double copy in DG_DrawFrame, `HEAPU8` export).

## Regression I introduced and fixed

At `052978a`, `ASYNCIFY_IGNORE_INDIRECT` left `dynCall_v` uninstrumented. That export is the
main loop's call into `frame()` through the function table. On rewind it was called with no argument, so
there were 100+ `RuntimeError: null function` page errors and T2/T7 failed.
Evidence: `artifacts/runs/coder-iter2-review-fixes/logs/run_all.log` and `tests/results.json` (rev `052978a`),
plus `probe/error_probe.js`. The fix is in `62b1bcd`.

## Test results at 62b1bcd

`node tests/run_all.js --run-id coder-iter2-62b1bcd` → **exit 1**.
Evidence: `artifacts/runs/coder-iter2-62b1bcd/` (`logs/run_all.log`, `tests/results.json`, screenshots).

| Check | Result |
|-------|--------|
| self-tests (7) | PASS |
| **T1 build** | **FAIL**: build exit 0 and all files present, but `doom.wasm` 382,276 B < 500 KB threshold |
| T2 serve | PASS (0 page errors) |
| T3 boots | PASS (61 ms, 105 frames/3 s) |
| T4 pixels | PASS |
| T5 input | PASS (keys reach the game after the test clicks `#canvas`) |
| T6 gameplay | PASS |
| T7 stability | PASS (0 page errors, 105 frames in final 3 s) |
| T8 WAD | PASS |

**T1 needs a tester/root decision.** The review already said the 500 KB floor is weak evidence ("passes
partly *because* of instrumentation"). Limiting Asyncify, as requested, drops the binary below it. I did not
pad the binary or edit the check. Options for the tester: lower the threshold or replace it (e.g. check
for the exported `doom_key_event`/`main`), with the reason recorded in the criteria-change log.

## Extra probes (scratch, not protected checks)

`artifacts/runs/coder-iter2-review-fixes/probe/behavior_probe.js <dir>`. Outputs:
- `behavior_probe_release_62b1bcd.txt` (dist/ at 62b1bcd)
- `behavior_probe_debug_assertions.txt` / `behavior_probe_debug_profiling.txt` (the same objects linked with
  `-sASSERTIONS=1` (+ `--profiling-funcs`) into `build/debug/`; Asyncify asserts were on during the wipe and
  gameplay and none fired)

| Probe | Result |
|-------|--------|
| Esc with the canvas unfocused | frame diff 0, `defaultPrevented` false |
| Esc with the canvas focused | diff 0.92 |
| Ctrl+ArrowUp | prevented, so it reaches the game |
| Ctrl+L, F12 | not prevented |
| Quit Game (Esc, Up, Enter, y) | `doomExited` true, status message shown, 0 frames in the next 2 s |

## Known gaps

- **Quit traps in engine code.** After our handler runs, `I_Quit` keeps walking the exit list and calls
  `G_CheckDemoStatus` through `(atexit_func_t)`, a cast from `boolean(void)`. wasm rejects this with
  `RuntimeError: function signature mismatch` (stack: I_Quit ← M_QuitResponse ← D_ProcessEvents ← …
  ← frame). The page has already stopped and shows the exit message, but the error is uncaught and the
  exit functions after it (`M_SaveDefaults`, `D_Endoom`) never run. Config is in MEMFS and lost anyway.
  `third_party/` is read-only. A possible platform-side fix: have `on_engine_exit` call
  `emscripten_force_exit()` to unwind before the bad call. I did not try it. I have not checked whether
  1888d9c trapped the same way, though the engine code path is unchanged.
- Startup failures before `main` reaches `I_AtExit` (e.g. a WAD load error inside `doomgeneric_Create`)
  are covered by the first registration. I did not test this.
- Weapon switching while holding Ctrl uses Ctrl+Digit. Some browsers reserve that combo for tab switching.
- Unchanged from iteration 1: no sound, no mouse, no persistence, 640x400 aspect.

## Next action

Tester/root: decide on T1's size threshold (record the change and its reason), then rerun
`node tests/run_all.js` at `62b1bcd` or later. Reviewer: re-review `052978a..62b1bcd`.
Optional follow-up for the coder: fix the quit trap via `emscripten_force_exit`.
