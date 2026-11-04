# Acceptance criteria — iteration 1 (DOOM in the browser)

These criteria were written by the tester **before** the port was implemented
(source revision `37dfee6`). They are protected acceptance checks: the coder
must not edit anything in `tests/`.

## How to run

```sh
node tests/run_all.js [--run-id <id>] [--skip-build] [--headed]
node tests/run_all.js --self-test     # negative controls only (no build/browser needed)
node tests/play.js   [--run-id <id>]  # scripted play session with screenshots
```

- Exit code is nonzero if any check fails. Each check prints `PASS`/`FAIL`.
- Results go to `artifacts/runs/<run-id>/tests/results.json` with the git
  commit hash, a dirty-tree flag, the `git status --porcelain` output, timings,
  and per-check details. Screenshots for each check are saved next to it.
- The default run-id is `test-<UTC timestamp>`; earlier runs are never overwritten.
- `dist/` is served from `127.0.0.1` on a random port by a tiny Node static
  server inside `run_all.js` (no external network). Browser: Playwright Chromium.

## Test hooks the port must provide (from the plan)

- `<canvas id="canvas">` that the game draws on (2D context, readable via `drawImage`).
- `window.doomReady === true` after the first drawn frame.
- `window.doomFrameCount` — integer incremented once per `DG_DrawFrame`.

## Pixel conventions used below

Frames are read by copying `#canvas` into an offscreen 2D canvas and calling
`getImageData`. "Diff fraction" = fraction of sampled pixels (every 4th pixel
in x and y) whose summed |ΔR|+|ΔG|+|ΔB| exceeds 48. "Distinct colors" counts
unique RGB triples among sampled pixels.

## Checks

| ID | Criterion (all must hold) | Negative control (must FAIL) |
|----|---------------------------|------------------------------|
| T1 build | `bash platform/build.sh` exits 0 within 10 min; `dist/` contains `index.html`, `doom.js`, `doom.wasm`, `doom.data`; `doom.wasm` > 300 KiB (307,200 bytes; was 500 KB, see "Criteria changes"). | Missing/empty `doom.wasm` or nonzero exit fails. |
| T2 serve | `doom.wasm` response has `Content-Type: application/wasm`; during the first 10 s after load there are 0 console errors, 0 `pageerror`s, 0 failed requests, 0 HTTP ≥ 400 responses. | Serving wasm with wrong MIME, or a 404 for `doom.data`, fails. |
| T3 boots | `window.doomReady === true` within 30 s of navigation; `doomFrameCount` increases by ≥ 20 over a 3 s window. | A page that never sets `doomReady`, or a frozen counter, fails. |
| T4 pixels | Canvas frame: ≥ 16 distinct colors; < 90 % of samples are a single color; **every** sampled pixel has alpha 255 (catches BGRX→RGBA bugs). A frame captured ≥ 6 s later (title/demo cycle) differs from the first drawn frame by diff fraction ≥ 0.05. | `--self-test`: an all-black frame fails (colors), a frame with alpha 0 fails (alpha), two identical frames fail (change). |
| T5 input | Press `Escape` on the title → frame diff ≥ 0.02 vs. before (menu drawn). Then `Enter`,`Enter`,`Enter` (New Game → episode → skill) and wait 3 s → frame diff ≥ 0.10 vs. the menu frame, and the status-bar region (bottom 16 % of canvas) differs from the title screen. | Keys not delivered (no change) fails. |
| T6 gameplay | In level: hold `ArrowUp` 2 s → view diff ≥ 0.05; hold `ArrowLeft` 1 s → view diff ≥ 0.05; press `Control` 3 times → the ammo digits region (x 0–15 %, y 84–100 % of canvas) diff ≥ 0.01 vs. before firing. | Frozen view / ignored fire key fails. |
| T7 stability | 60 s of random game keys (arrows, Ctrl, Space, Shift, Enter, Escape, 1–3) with key-up for every key-down: 0 `pageerror`s, no page crash, `doomFrameCount` still advancing at the end (≥ 20 frames in a final 3 s window). | A hang (e.g. infinite wipe loop) freezes the counter → fails. |
| T8 WAD | All requests go to the local server (127.0.0.1); no request URL ends in `.wad`; `doom.data` is ≥ 4,196,020 bytes (size of `assets/doom1.wad`); game reached the level in T5 (proves the WAD was read). | A build that fetches a WAD over the network or ships a truncated data file fails. |
| T9 colors | Red/blue fidelity. A sample counts as red if R > B+40 and blue if B > R+40. In the title-logo region (x 20–80 %, y 15–50 %) of the first drawn frame, red samples > 2× blue samples. The ammo-digits region (T6) of the level frame must meet the same rule. | `--self-test`: an R/B-swapped copy of a red frame fails. |
| T10 idle | With no keys held for 2 s right after T5 spawns the player, the view region (x 10–90 %, y 15–70 %) diff fraction is < 0.10 vs. the T5 level frame. This catches phantom input, a runaway game clock, or demo playback in place of a new game. | `--self-test`: two different frames in the view region give a diff ≥ 0.10, so that pair would fail. |

Thresholds are deliberately loose: they test "the game reacts" rather than exact
pixels, so they are robust to timing jitter but cannot prove fidelity.

## Negative controls

`node tests/run_all.js --self-test` feeds synthetic frames (blank, transparent,
identical, single-color) into the same pixel predicates used by T4–T6 and
asserts that each one is rejected. It also asserts a realistic noise frame is
accepted. This shows the predicates can fail; it does not replace breaking the
real build (regression injection is done by the loop/instructor).

## Limits — what these checks cannot establish

- Pixel heuristics can't prove faithful rendering: a red/blue swap with alpha 255
  would still pass T4 (only visual review / the play screenshots catch it).
- Sound is not tested at all.
- No human judgment of game feel: input latency, frame pacing, mouse look.
- Gameplay checks show the frame *changes* after input, not that the change is
  correct (e.g. walking vs. turning could be confused).
- Only Chromium (headless) is exercised; other browsers are untested.
- Save/load, later levels, and full episode play are not covered.
- Timing thresholds may flake on a heavily loaded machine; failures should be
  re-run once before being reported as regressions, and both results kept.

## Criteria changes

| Date | Check | Change | Reason |
|------|-------|--------|--------|
| 2026-11-04 | T1 | `doom.wasm` size floor lowered from 500 KB to 300 KiB (307,200 bytes). | The 500 KB figure was a guess made before the port existed (rev `37dfee6`). The real build at `62b1bcd`/`ac94313` produces a 382,276-byte `doom.wasm` that is complete and boots. The floor still rejects missing, empty or stub modules; it is not evidence of fidelity. Requested by the user; applied after seeing the failing result, so it is a loosening and is recorded as such. Prior failing evidence under `artifacts/runs/` is preserved. |

### 2026-11-04 — T9 and T10 added after blind-regression baseline (tester)

Commit `f933c23` (two injected regressions) passed all checks T1–T8
(`artifacts/runs/test-2026-11-04T21-49-23-940Z`). Its screenshots showed swapped red
and blue channels and a player state that had drifted on its own at level start.
T9 and T10 were added for these failures. Their thresholds were checked against
`de0dfe0` (passes) and `f933c23` (fails). See `artifacts/test_report_f933c23_vs_de0dfe0.md`.
Limit: T9 tests only whether red or blue dominates, not exact palette values.
T10 cannot tell a fast game clock apart from a stuck key.

