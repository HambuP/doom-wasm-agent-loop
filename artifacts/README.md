# Run artifacts

**Agents must use this folder for durable artifacts between runs.**

The distributed starter contains only this README in this folder. Create
run records when student work begins; starter preparation notes and sample
results are not included.

Anything saved for a later agent or run—state, plans, handoffs, logs, review
findings, test results, screenshots, recordings, or reports—belongs here.
Fresh agent contexts must be able to resume using the repo and this folder.

Loop code, prompts, and configuration belong in [`loop/`](../loop/README.md).
Port code belongs in `platform/` and `web/`, verification code in `tests/`,
and game assets in `assets/`. Shared build files may live at the root. Build products
may live in `build/` or `dist/`; link to them from a run record when useful.
Temporary scratch files may be disposable, but anything needed for a
handoff, resumption, or evaluation must be copied here before a run ends.

## Suggested layout

You can choose a different layout inside this folder. Document it so another
agent can find the current state without reading your conversation.

```text
artifacts/
  README.md
  state.json                 # Current run, next task, and stopping status
  runs/
    <unique-run-id>/
      manifest.json          # Source revision, environment, budgets, usage
      handoffs/              # Tasks and responses between roles
      reviews/               # Findings and their resolution
      logs/                  # Tool and build output
      tests/                 # Commands, results, screenshots, recordings
      summary.md             # Outcome and next steps
```

## Required habits

- Give each run a unique ID. Preserve earlier results instead of overwriting
  failure evidence with the latest passing output.
- Record the source revision and any uncommitted changes being tested.
  Evidence from an older revision does not establish that the current one passes.
- Save the current task, unresolved findings, artifact paths, and next action
  before handing off or stopping. Include the stopping reason and resource usage.
- Reference evidence with paths relative to the repo, so it works in a sandbox.
- Include the artifacts needed to assess your submission. Explain any omitted
  large files and how to reproduce them.
- Do not store credentials, API keys, or commercial game data here. Sanitize
  logs before saving them.

This folder starts with instructions only. Your loop creates the run records.
