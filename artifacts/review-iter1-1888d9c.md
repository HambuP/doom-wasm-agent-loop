# Review — commit 1888d9c (iteration 1 port)

Reviewer: reviewer role. Reviewed: `git show 1888d9c` (platform/build.sh, platform/doomgeneric_wasm.c, web/index.html)
against `artifacts/plan.md` and `artifacts/coder_report.md`. Static review only; I did not rebuild or rerun tests.

## Verdict
Mostly sound and the plan is followed. Two departures from the plan (ASYNCIFY sleep; compiling dummy.c, no SDL stub)
are justified in the coder report. Issues to resolve below; none is known to block, but #1–#3 need evidence or fixes.

## Challenges to coder decisions
1. **ASYNCIFY sleep inside an `emscripten_set_main_loop` callback (doomgeneric_wasm.c DG_SleepMs/frame).**
   The plan offered a busy-wait or no-op; the coder chose `emscripten_sleep`. That works for the wipe, but `frame()` can now
   unwind mid-`doomgeneric_Tick()`. Show that the main-loop runner cannot re-enter `frame()` while a Tick is suspended
   (re-entrancy would corrupt engine state). The probe (max rAF gap 18 ms) shows pacing, not absence of re-entry.
   Ask: add a `static int in_tick` guard (or assert) in `frame()` and log if it ever trips.
2. **Whole-program ASYNCIFY cost.** Every function is instrumented. Use `-sASYNCIFY_ADD`/`ASYNCIFY_ONLY` limited to the
   I_Sleep call paths (D_Display wipe, TryRunTics), or document why not. Note: wasm is 539,314 B vs T1's 500 KB floor;
   the size check passes partly *because* of instrumentation. That threshold is weak evidence, not a feature.
3. **`-Wno-everything` in build.sh.** Hides all warnings, including in our own platform file. Drop it, or scope it to
   third_party sources and compile `platform/doomgeneric_wasm.c` with `-Wall -Wextra`.
4. **Global key capture (index.html).** Listeners are on `window` and `preventDefault` every mapped key, so F5, F11, F12,
   Ctrl+R/Ctrl+L/etc. are swallowed even when the canvas is unfocused. Limit to when the canvas has focus, or skip events
   with Meta/Ctrl+non-game combos. Alt as strafe also triggers menu bar on Windows/Linux.
5. **Quit path.** `EXIT_RUNTIME=0` + engine `exit()` on Quit Game: page freezes with no message. Handle `onExit`/`onAbort`
   with a visible status (onAbort is set; `onExit` is not).
6. **Display aspect.** 640x400 canvas shows Doom's 320x200 at square pixels; original is 4:3 (should present as 640x480 /
   CSS-scaled). Not in the plan, but it is a fidelity gap the player will notice. Record as next-iteration item.
7. **No sound, no mouse.** Allowed as stretch items; must be listed as known gaps (report does list mouse/sound? — confirm).

## Minor
- `frame()` tic gate duplicates `I_GetTime` math; fine, but comment that it must stay in sync with TICRATE in the engine.
- `DG_DrawFrame` converts into a static buffer then copies again into ImageData; could write directly via a
  `Uint8ClampedArray` view on HEAPU8 (re-create after memory growth). Perf is fine now; low priority.
- `HEAPU8` in `EXPORTED_RUNTIME_METHODS` is unnecessary for EM_ASM use; harmless.
- Key ring buffer of 64 drops input silently when full; acceptable, comment already says so.

## Process / evidence
- Tests that "ALL PASS" (`tests/run_all.js`, `tests/play.js`, edits to `tests/CRITERIA.md`) are **uncommitted**, so the
  checks the coder ran are not pinned to any revision. Tester/root should commit them so 1888d9c's results are reproducible.
- Coder stayed within platform/ and web/ in this commit; no changes to tests/, loop/, assets/, third_party/. Good.

## Next action
Coder: address #1 (guard + evidence), #3, #4, #5; decide on #2. Root: get tests committed and record in artifacts/state.json.
