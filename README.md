# Doom in the browser

Port Doom to WebAssembly so that playing it in a browser feels as close to
1:1 as you can make it.

You have one week. The point of the week is not Doom. It is learning to
architect an agentic loop that can finish a large task on its own, and
to know when to trust it.

## Constraints

- Toolchain: Emscripten.
- Game data: the shareware `doom1.wad` (put it in `assets/`).
- Engine: the doomgeneric source in `third_party/doomgeneric/`. Its
  platform ports (including its Emscripten and SDL ports) have been
  removed. Your platform layer starts in `platform/doomgeneric_wasm.c`.
- Run your loop in a sandbox (see `SANDBOX.md`).
- Do not hand-write the port yourself while the loop is running.
  The loop does the work; you design the loop and the checks.

## Done

It feels like Doom in a browser. "Feels like" is the hard part of this
assignment: you decide what that means, and how you would know.

## What is here

- `third_party/doomgeneric/`: the engine, GPL-2.0. Keep the license notices.
- `platform/`: your platform layer, currently empty stubs.
- `web/`: a bare page with a canvas.
- `Dockerfile`, `SANDBOX.md`: the sandbox toolchain.
- `assets/`, `tests/`: empty on purpose.

## What you build

- The loop: the script, the prompts, and the files that carry state
  between iterations.
- The build.
- The verification.
- The port.

Nothing for these is provided. Start by building the loop, not the port.

## Thinking about verification

You write the checks. These questions are how to design them.

**Define done first**
- "It feels like Doom" is not something a program can check. What
  observable things would be true if it did? Which of those can code
  measure, and which need a judge?
- If you can't state a check as pass or fail, the loop can't use it.

**Trust the check, not the agent**
- The agent saying "done" is a claim, not evidence. What would you want
  to see before believing it?
- If you were an agent trying to pass this check with the least effort,
  what would you do? Close that gap.
- Can the loop edit its own checks? Should it?

**Test the checker**
- Have you seen each check fail on purpose? A check that has never
  failed might not be checking anything.
- Is it deterministic? A flaky check teaches the loop to chase noise.

**Order and cost**
- Which checks are fast and cheap, and which are slow or expensive?
  What happens if you run the cheap ones first?
- Which things can code check, and which need a second agent or a human?
  If you use a second agent, what should it see, and what should it not
  see?

**Feedback for the next iteration**
- The next iteration starts with no memory. When a check fails, what does
  the failure output need to say so it can act on it?
- Where does that information live between iterations?

**Stopping**
- What ends the loop besides success? What does it cost if it doesn't stop?
- When progress stalls, how would you tell thrash from slow progress?

## Hand in

- The repo, with a readable git history.
- A short write-up: how your loop is built, what your checks are, and
  what the loop got wrong that your checks did or did not catch.

## License

Doom source: GPL-2.0 (see `LICENSE`). Only the shareware WAD is cleared
for this project.
