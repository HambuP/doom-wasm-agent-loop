# Your agent loop

**Keep all student-created loop code and configuration in this folder.**

This is where you build the system that coordinates the coder, reviewer,
and tester. The implementation is yours to design; no loop is provided.

## What belongs here

- The orchestrator and its start/resume commands.
- Role definitions, prompts, and handoff schemas.
- MCP server/client code, tool definitions, and configuration.
- Role permissions, sandbox policies, and network allowlists.
- Dependency manifests and lockfiles for the loop.
- Loop-specific documentation and configuration examples without secrets.

Use subfolders when they help. For example:

```text
loop/
  README.md        # This file
  prompts/         # Instructions for each role
  loop.sh          # Bash loop
  agents.yml	   # Docker Agent team spec
```

These names are suggestions. Choose your own structure inside `loop/` and
document the entry point, dependencies, and configuration it needs.
Resolve paths relative to the repository so the loop works in the sandbox.

## Where everything else goes

| Content | Location |
| --- | --- |
| Saved state, handoffs, logs, findings, and run evidence | `artifacts/` |
| Port implementation and browser page | `platform/`, `web/` |
| Verification code, including checks for the loop itself | `tests/` |
| Game data | `assets/` |
| Generated build output | `build/` or `dist/` |
| Shared build/toolchain files | Repository root |

Keep reusable prompt templates here; save the actual tasks and responses
from each run in `artifacts/`. Keep secrets out of the repository and sandbox.
