# DOOM → WebAssembly, ported by a multi-agent loop

**▶ Play it:** <https://hambup.github.io/doom-wasm-agent-loop/>

BSE Fellowship (UCLA, Fall 2026) — Loop Engineering track capstone.
The goal was not just to get DOOM running in a browser, but to design a
**multi-agent system** that ports the supplied C engine to WebAssembly
(Emscripten) and **proves** the result works. The original assignment brief
is in [`BRIEF.md`](BRIEF.md).

**Team:** Santiago Forero ([@HambuP](https://github.com/HambuP))

---

## The loop

Entry point: [`loop/agents.yaml`](loop/agents.yaml) (Docker Agent team spec).
I designed the loop; the YAML syntax was formatted with Claude from my
written design, with no design decisions added.

| Role | Model | Job | Writes to |
| --- | --- | --- | --- |
| **Root** (orchestrator) | Qwen3 (local, Docker Model Runner) | Runs iterations, keeps state, decides when to stop | `artifacts/` only (enforced) |
| **Architect** | Claude Sonnet | Turns the goal + last feedback into a plan for coder and tester | `artifacts/plan.md` |
| **Tester** | Claude Opus | Writes the tests once, from `tests/CRITERIA.md` | `tests/`, `artifacts/` |
| **Coder** | Claude Opus | Writes the port in `platform/` + `web/`, builds to `dist/`, commits | `platform/`, `web/`, `artifacts/` |
| **Reviewer** | Claude Opus | Reads the real `git diff` and challenges the coder's decisions | `artifacts/review.md` |
| **Verifier** | Claude Sonnet | Runs `tests/run_all.js`, records results with the commit hash | `artifacts/test_results.md` |
| **Player** | Claude Opus | Plays the game with Playwright, checks screenshots end to end | `artifacts/player_report.md` |

**Order per iteration:** architect → tester (first iteration only) → coder → reviewer → verifier → player.
Any problem found by the reviewer, verifier, or player starts a new iteration with that feedback.

### Design decisions

- **Work:** the root gives the architect a bounded goal ("iteration X of 5")
  plus the previous iteration's feedback; the architect splits it into tasks.
- **Context:** every agent starts fresh. What survives is on disk in
  `artifacts/` (plan, reports, reviews, test results, `state.json`).
- **Authority:** the coder can never edit `tests/` or `loop/`, so it can't
  weaken the checks it's judged by. Only the player's feedback can make the
  tester change tests, and the reason must be logged in
  `artifacts/criteria_changes.md`.
- **Evidence:** success requires **all tests passing AND screenshots of the
  game actually being played**. Tests alone or a report alone are not enough.
- **Recovery & stopping:** state lives in `artifacts/state.json`, so a stopped
  run resumes where it left off. The loop stops on success, after 5
  iterations, or if the same tests fail 3 iterations in a row.

## Testing the loop: blind regressions

To check that the loop catches real bugs (not just builds the game once), an
external agent injected **two blind regressions** (`f933c23`):

1. A **red/blue color swap** in `DG_DrawFrame`
2. **Key-down events losing their key code**

The repair run (tag `run2-repair`, `6b542ed`) fixed both, with evidence in
`artifacts/`. Two checks target these failure modes:
**T9 color fidelity** and **T10 idle stability**.

## Run it

```bash
# build the port (output in dist/)
bash platform/build.sh

# play locally
cd dist && python3 -m http.server 8000   # open http://localhost:8000

# run the tests
node tests/run_all.js

# run the agent loop (from the repo root)
docker agent run loop/agents.yaml
```

**Needs:** Emscripten, Node + Playwright, Docker with Model Runner (`ai/qwen3`),
and Claude Code logged in.

## Repository layout

| Path | Contents |
| --- | --- |
| `loop/` | The loop: agent team spec and its docs |
| `platform/`, `web/` | The port and browser page (written by the coder agent) |
| `tests/` | `CRITERIA.md`, `run_all.js`, `play.js` |
| `artifacts/` | Run evidence: plans, reviews, test results, screenshots, `state.json` |
| `third_party/`, `assets/` | Supplied Doom engine and game data |

## Known issues & limitations

- **No sound.** The game plays, but audio isn't ported yet.
- **Permissions aren't enforced for the Claude Code agents.** The harness runs
  them with `--dangerously-skip-permissions` and ignores toolsets, so the
  per-role permissions above are stated in their instructions, not enforced by
  tools. Only the root's (artifacts-only) access is enforced.

## License

See [`LICENSE`](LICENSE). The Doom engine in `third_party/` keeps its original license.
