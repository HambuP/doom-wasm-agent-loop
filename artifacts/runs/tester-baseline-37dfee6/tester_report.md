# Tester report — iteration 1
Source revision: 37dfee6 (dirty: untracked package.json, plan, tests).
Wrote tests/CRITERIA.md, tests/run_all.js, tests/play.js.
- `node tests/run_all.js --self-test`: 7/7 negative controls PASS.
- `node tests/run_all.js --skip-build`: T1–T8 FAIL as expected (no dist/ yet); exit 1. results.json here.
- Browser path (T2–T8, play.js) has not run against a real build yet; thresholds may need one calibration
  pass by the tester (not the coder) once a build exists.
Next action: coder implements platform/build.sh, platform/doomgeneric_wasm.c, web/index.html per artifacts/plan.md.
