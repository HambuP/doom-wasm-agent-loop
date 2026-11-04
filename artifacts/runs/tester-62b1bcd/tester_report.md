# Tester report: commit 62b1bcd

Source tested: HEAD ac94313, which differs from 62b1bcd only under `artifacts/` (`git diff --stat 62b1bcd HEAD -- . ':!artifacts'` is empty). The working tree was dirty only with untracked artifacts.
Commands: `node tests/run_all.js --run-id tester-62b1bcd`, `node tests/play.js --run-id tester-62b1bcd`

## Results (tests/results.json)
- self-test: PASS (all negative controls)
- **T1 build: FAIL**. emcc exit 0, all four dist files present, wasmSize=382276. The check requires wasmSize > 512000 (`tests/run_all.js:227`). The failure is the size threshold only; the build itself succeeded. Whether the threshold or the build is wrong is for the reviewer/owner to decide. I did not edit the protected check.
- T2 serve, T3 boots, T4 pixels, T5 input, T6 gameplay, T7 stability, T8 WAD: PASS

## Evidence
- Results and build log: artifacts/runs/tester-62b1bcd/tests/ (results.json, build.log, t*.png)
- play.js screenshots (14): artifacts/runs/tester-62b1bcd/screenshots/01-title.png … 14-menu-closed.png
