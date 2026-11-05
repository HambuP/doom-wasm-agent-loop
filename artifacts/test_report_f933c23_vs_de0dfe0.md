# Tester report: f933c23 (blind regressions) vs de0dfe0 (last good)

Tests: `tests/run_all.js` with new checks T9/T10 (uncommitted working-tree edit to tests/; dirty flag set in results).

| Check | de0dfe0 | f933c23 |
|---|---|---|
| T1–T5, T7, T8 | PASS | PASS |
| T6 gameplay | PASS (ammoRegionDiff 0.143) | **FAIL** (ammoRegionDiff 0; flaky — passed 0.172 in prior run) |
| T9 colors (new) | PASS (logo red 2218 / blue 247; ammo red 79 / blue 0) | **FAIL** (logo red 247 / blue 2218; ammo red 0 / blue 58) |
| T10 idle (new) | PASS (idleViewDiff 0) | **FAIL** (idleViewDiff 0.658) |

Evidence:
- artifacts/runs/tester-baseline-de0dfe0/tests/ (results.json, console.log, screenshots)
- artifacts/runs/tester-regress-f933c23/tests/ (same)
- Earlier run (old checks only): artifacts/runs/test-2026-11-04T21-49-23-940Z — all T1–T8 PASS on f933c23, so those checks missed both regressions.

Observed symptoms (from behavior only; the tester did not read the source diff):
1. Red and blue channels swapped in the rendered output (logo, status bar digits, skin all blue).
2. After New Game, the player changes state/position without input: within ~3 s, health 83 %, armor 94 %, ammo 11, "Picked up a clip". The game clock is running too fast, or input is being injected.

Next action: hand the failing T9, T10, and T6 results with this evidence to the coder for blind repair, then rerun `node tests/run_all.js` on the fix commit.
