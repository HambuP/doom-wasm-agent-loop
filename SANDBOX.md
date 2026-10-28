# Sandbox setup

Run your loop inside a sandbox, not on your own machine.

- Mount only this repo into the sandbox.
- Use the `Dockerfile` here as the toolchain image (Emscripten included).
- Network policy: deny by default. Allow only what you decide you need,
  for example the Emscripten docs. Decide this on purpose and write down
  why. Existing browser ports of Doom are on the open web; this project
  is you building yours.
- Credentials: none should be present in the sandbox.

How you configure this depends on your sandbox tool. Writing the
config file for it is part of your Day 1 work.
