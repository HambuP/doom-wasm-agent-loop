# Plan — iteration 1 of 5 (port DOOM to the browser)

Source revision at planning time: `f933c23` (branch `capstone`, clean except untracked `artifacts/state.json` and
`artifacts/runs/test-2026-11-04T21-49-23-940Z/`). Supersedes nothing: `artifacts/plan.md` (written at `37dfee6`) is kept as history.
`artifacts/state.json`: `current_iteration=1, max_iterations=5, failing_tests=[]`.

## Situation (verified by reading the repo, not assumed)
- A working port already exists: `platform/build.sh`, `platform/doomgeneric_wasm.c`, `web/index.html`, `tests/run_all.js`,
  `tests/play.js`, `tests/CRITERIA.md`. Earlier runs live in `artifacts/runs/`.
- `artifacts/regressions_note.md` says 2 regressions were injected blind (external agent, commits `59a3b6f`, `f933c23`; both
  touch `platform/doomgeneric_wasm.c`).
- The latest protected suite, run `test-2026-11-04T21-49-23-940Z` at `f933c23` (clean tree), reports **all checks PASS**
  (self-test, T1–T8). So either the regressions are outside what T1–T8 measure, or the checks are too weak.
  Both outcomes are findings. Do not report "all green" as "no regression".
- This planner did not read the injection diffs, to keep the repair blind. Cause analysis is the agents' job.

## Goal of iteration 1
Find and repair the regressions in `f933c23`, and make the checks capable of seeing them, without weakening any criterion.
Exit condition: protected suite passes on the new revision AND new/strengthened checks demonstrably FAIL on `f933c23`.

## Order and permissions
tester (baseline + gap analysis) -> coder (repair) -> reviewer -> tester (re-verify) -> root decides stop/next iteration.
Each role is a fresh context and works only from the repo and `artifacts/`.

| Role | May write | Must not write |
| --- | --- | --- |
| tester | `tests/`, `artifacts/` | `platform/`, `web/`, `loop/`, `assets/`, `third_party/` |
| coder | `platform/`, `web/`, `artifacts/` | `tests/`, `loop/`, `assets/`, `third_party/` |
| reviewer | `artifacts/` only (read-only elsewhere) | all source and tests |

## Tester tasks (run first, then again at the end)
1. Baseline: run `node tests/run_all.js --run-id tester-baseline-f933c23`. Record commit, dirty flag, and results under
   `artifacts/runs/tester-baseline-f933c23/`. Keep failing output if any.
2. Behavioural probe for regressions, using `tests/play.js` and Playwright against a fresh build of `f933c23` (no source
   reading required). Compare with the known-good `de0dfe0` built in a separate worktree/dir (`build/` or `/tmp`, not tracked).
   Check, at minimum: pixel colors vs. expected palette (red/blue swap, alpha), frame pacing (35 Hz tics vs. rAF; game speed
   over 10 s of real time), every mapped key (arrows, Ctrl, Space, Shift, Enter, Esc, Tab, Y/N, 1–7, letters, key release,
   release-all on blur), menu navigation, level start, movement distance per held second, firing and ammo decrement, door use,
   window title, quit/restart, and behaviour after tab blur/refocus.
3. For each behaviour that differs between `de0dfe0` and `f933c23`, write a protected check in `tests/` (new T-id, documented in
   `tests/CRITERIA.md` under "Criteria changes" with reason; do not loosen existing thresholds). Each new check must fail on
   `f933c23` and pass on `de0dfe0`; save both results as evidence.
4. Add negative controls to `--self-test` for each new predicate.
5. Report to `artifacts/runs/<run-id>/handoffs/tester-to-coder.md`: failing check IDs, observed vs. expected values, evidence
   paths, repro commands. Describe symptoms only, not guessed causes. Also write the miss analysis: why T1–T8 passed at `f933c23`.
6. Final pass (after coder): rerun the whole suite on the coder's commit; report with commit hash and dirty flag.

## Coder tasks (start only after the tester handoff exists)
1. Read the tester handoff, `platform/README.md`, and `artifacts/coder_report*.md`. Work from symptoms and failing checks.
2. Diagnose in `platform/doomgeneric_wasm.c`, `platform/build.sh`, `web/index.html`. Reproduce each failure locally first.
   Save logs to `artifacts/runs/<run-id>/logs/`.
3. Fix root causes, one commit per fault, touching only `platform/` and `web/`. Do not edit `tests/`, `loop/`, `assets/`,
   `third_party/`. Do not special-case the tests (no hooks that fake `doomReady`/`doomFrameCount`, no pixel tricks).
4. Preserve existing behaviour: Asyncify scoping, tick guard, key focus, quit, `window.doomReady`, `window.doomFrameCount`,
   emcc 4.0.18 pin, packaged WAD at `/doom1.wad`.
5. Run `bash platform/build.sh` and the protected suite; report every failure, including ones not fixed.
6. Write `artifacts/runs/<run-id>/handoffs/coder-to-reviewer.md`: commit hashes, files changed, per-fault cause/fix/evidence,
   unresolved issues, next action. If a fault cannot be fixed within 3 attempts, stop and record it as unresolved.

## Reviewer tasks (after coder)
1. Review `git diff <baseline>..HEAD` for `platform/` and `web/`, the tester handoff, and the coder handoff. Do not trust the
   coder's report; check claims against the code and the saved test output.
2. Check: each reported fault has a matching root-cause fix; no test-gaming; no scope creep; no new warnings or console errors;
   no edits outside the coder's permissions (`git diff --stat` shows only `platform/`, `web/`, `artifacts/`); the tested
   commit equals the reviewed commit.
3. Look for faults that nobody has detected yet (frame pacing, input edge cases, memory growth, resource leaks, unhandled
   key release) and list them as findings with evidence or a concrete repro.
4. Write `artifacts/runs/<run-id>/reviews/review-iter1.md`. Each finding has an ID, severity, evidence path, and status
   (open/fixed/disputed). Verdict: `approve` or `changes-requested`. Disagreements with the tester or coder go in the
   file with both positions; the root decides.

## Acceptance criteria for iteration 1
- A1: Both injected faults are identified (by symptom and root cause) and fixed in commits touching only `platform/`/`web/`.
- A2: Protected suite is green on the final commit, from a clean tree, with `results.json` naming that commit.
- A3: At least one new or strengthened check per fault fails on `f933c23` and passes on the fixed commit. Both results saved.
- A4: Reviewer verdict is `approve`, with no open high-severity findings.
- A5: A write-up of what the original T1–T8 missed and why, plus what remains unverifiable (sound, feel, fidelity).

## Stopping and recovery rules
- Success: A1–A5 hold -> root updates `artifacts/state.json` (`failing_tests: []`) and records the stop or moves to iteration 2.
- Retry budget: 3 coder repair attempts per fault; if a fault remains failing, record it in `state.json.failing_tests` and
  stop with reason "exhausted". If two attempts show no change in failing checks, stop with reason "stalled".
- Interrupted run: each role writes its handoff before stopping; the next fresh context resumes from
  `artifacts/state.json` and the latest `handoffs/` file.
- Preserve failing evidence; never overwrite earlier run directories. Each run ID is unique and names the commit tested.

## Risks
- Regressions may be in areas the pixel heuristics cannot see (timing drift, key mapping edge cases, memory). The tester must
  add direct measurements (e.g. `doomFrameCount` vs. in-game tic rate, per-key effect) rather than larger thresholds.
- Comparison with `de0dfe0` is only a baseline for the tester. It is not a license for the coder to revert; the repair needs
  a root-cause understanding and passes review.
- Playwright Chromium covers one browser only; record that limit.

## Next action
Root: dispatch the tester with the section "Tester tasks", using a fresh run ID, then update `artifacts/state.json`.
