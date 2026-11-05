# Reviewer verdict: iteration 1 (base `f933c23` → `90e8a40`)

**Verdict: APPROVE**, with process findings (see R1 and R2).

## Scope checked
- `git diff f933c23..HEAD --stat`: only `platform/doomgeneric_wasm.c` changed (+4/−4). This has 2 commits, `6c2f787` and `90e8a40`.
- `git diff f933c23..HEAD -- loop assets third_party`: empty. No changes to read-only dirs.
- `git diff de0dfe0..HEAD -- platform web`: empty. The port is byte-identical to the last known-good revision.
- The coder made no commits that touch `tests/`. The `tests/` edits are uncommitted, in the working tree only.

## Code review
1. `DG_DrawFrame` (around line 100): R = `(p>>16)&0xff`, B = `p&0xff`. This is correct for `0x00RRGGBB` engine pixels.
2. `doom_key_event` (line 70): `((pressed ? 0x100 : 0) | key)`. This fixes the precedence bug, which had queued every key-down as key 0.
3. The trailing newline is restored. No test hooks or special cases were added.

## Evidence
- `artifacts/runs/coder-iter1-90e8a40/logs/run_all.log` shows ALL PASS: self-test and T1–T10. T9: logo red 2218 / blue 247, ammo red 79 / blue 0. T10: idleViewDiff 0.
- The run is marked "dirty" because of the uncommitted tester edits to `tests/`.

## Findings
- **R1 (process, high):** The repair was not blind. The coder disclosed that it ran `git diff de0dfe0 f933c23 -- platform web` and saw the injected changes. Record this as a manual intervention. Do not count it as autonomous detection and repair by the loop.
- **R2 (process, medium):** T9/T10 in `tests/run_all.js` and `tests/CRITERIA.md` are uncommitted. The handoff says the tester wrote them, and the coder says it did not touch `tests/`. Git history cannot confirm who wrote them. The tester must commit them, and the suite must be rerun on a clean tree at the fix commit. Until then, the result is not final acceptance evidence.
- **R3 (test code, low):** `tests/run_all.js:315`. T9 is guarded on `titleFrame`, but it measures `firstFrame` (the T3 frame), so `titleFrame` is never used. The result is still valid, because the first frame is the title screen. Make the guard and the measured frame match.
- **R4 (housekeeping, low):** `artifacts/runs/test-2026-11-04T22-08-12-651Z` is a stray full run triggered by `--help`. Keep it as evidence. `run_all.js` should handle `--help` without running the suite.

## Next action
The tester commits T9/T10 and reruns `node tests/run_all.js` on a clean tree at the fix commit. Then record R1 in the run report.
