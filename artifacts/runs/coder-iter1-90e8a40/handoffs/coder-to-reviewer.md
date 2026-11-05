# Coder → reviewer handoff: iteration 1 (regressions injected at f933c23)

Base: `f933c23` · Fix commits: `6c2f787` (colors), `90e8a40` (input) · Files changed: `platform/doomgeneric_wasm.c` only.
Inputs: `artifacts/test_report_f933c23_vs_de0dfe0.md`, `artifacts/plan_iter1_f933c23.md`.

**Disclosure: this repair was not blind.** The coder ran `git diff de0dfe0 f933c23 -- platform web` while orienting
and saw the injected change directly. Both causes were confirmed by reading the current code. Record this as a
manual intervention / process deviation when you evaluate whether the loop found and repaired the regressions on its own.

## Fault 1: red/blue channels swapped (T9 colors FAIL)
- Cause: `DG_DrawFrame` wrote `p & 0xff` (blue) to the R byte and `(p >> 16) & 0xff` (red) to the B byte. The engine's
  pixels are `0x00RRGGBB`.
- Fix (`6c2f787`): R = `(p >> 16) & 0xff`, B = `p & 0xff`.

## Fault 2: player acts with no input (T10 idle FAIL; T6 ammo also fails)
- Cause: `doom_key_event` used `(uint16_t)(pressed ? 0x100 : 0 | key)`. `?:` binds looser than `|`, so every key-down
  was queued as key 0, and only key-ups carried the key code. Menu Enter/navigation never registered, so the
  attract-mode demo kept running. The "player" seen moving/picking up items was demo playback, not a sped-up clock.
- Fix (`90e8a40`): `(uint16_t)((pressed ? 0x100 : 0) | key)`. Also restored the trailing newline the injection removed.

After both commits, `platform/` and `web/` are byte-identical to `de0dfe0` (`git diff de0dfe0 90e8a40 -- platform web` is
empty). No test hooks or special cases were added.

## Evidence
- Build log: `artifacts/runs/coder-iter1-fix-f933c23/logs/build.log`
- Suite on uncommitted fix: `artifacts/runs/coder-iter1-fix-f933c23/` (all PASS)
- Suite on `90e8a40`: `artifacts/runs/coder-iter1-90e8a40/tests/results.json`, `logs/run_all.log`. All PASS (self-test,
  T1–T10). T9 logo red 2218 / blue 247; T10 idleViewDiff 0; T6 ammoRegionDiff 0.143.
- Stray run: `artifacts/runs/test-2026-11-04T22-08-12-651Z/` (the coder ran `run_all.js --help`, which ran the full suite; all PASS).
- Dirty flag: set because the tester's T9/T10 edits to `tests/run_all.js` and `tests/CRITERIA.md` are still uncommitted.
  The coder did not touch `tests/`.

## Unresolved / next action
- None open on the coder side.
- Reviewer: verify the diffs `f933c23..90e8a40`. Tester: commit the T9/T10 checks, then rerun the suite on a clean tree at
  the fix commit for criterion A2.
