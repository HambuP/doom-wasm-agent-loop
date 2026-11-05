# Tester acceptance report: T1–T10 at `0784fa2`

- **Revision tested:** `0784fa24a5603828ec843dc5589ffb204f9b81e0` (branch `capstone`). This commit adds T9/T10 to `tests/CRITERIA.md` and `tests/run_all.js`. The port code is the same as `90e8a40`.
- **Tree state:** no tracked files were modified. The runner says "(dirty)" only because untracked files exist under `artifacts/`. `platform/`, `web/` and `tests/` match HEAD exactly.
- **Command:** `node tests/run_all.js --run-id tester-acceptance-0784fa2` (full build, no skip)
- **Evidence:** `artifacts/runs/tester-acceptance-0784fa2/tests/results.json`, plus `build.log` and the screenshots in the same folder

## Results: ALL PASS (11/11, including self-test)

| Check | Result | Key metrics |
|---|---|---|
| self-test | PASS | 10/10 synthetic cases, including the T9 R/B swap and the T10 moving view |
| T1 build | PASS | wasm 382,276 B (floor 307,200) |
| T2 serve | PASS | application/wasm, 0 errors |
| T3 boots | PASS | ready in 83 ms, 105 frames in 3 s |
| T4 pixels | PASS | 116 distinct colors, top 8.3 % |
| T5 input | PASS | menu 0.943, level 0.978, status 0.103 |
| T6 gameplay | PASS | walk 0.315, turn 0.394, ammo 0.143 |
| T7 stability | PASS | 0 page errors, 105 frames in last 3 s |
| T8 WAD | PASS | data 4,196,020 B, no external/WAD requests |
| T9 colors | PASS | logo red 2218 / blue 247; ammo red 79 / blue 0 |
| T10 idle | PASS | idle view diff 0.000 (< 0.10) |

## Notes
- The two regressions injected at `f933c23` (R/B swap and drift at idle) are fixed by `6c2f787` and `90e8a40`. T9 and T10 now confirm both fixes. Earlier, T9/T10 failed against `f933c23` (see `artifacts/test_report_f933c23_vs_de0dfe0.md`).
- Known limits are listed in `tests/CRITERIA.md`. T9 checks only whether red or blue dominates. T10 cannot tell a fast clock apart from a stuck key.
- Next action: none for the tester. Ready for reviewer sign-off.
