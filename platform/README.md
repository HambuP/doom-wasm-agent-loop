# Browser port starting points

`doomgeneric_wasm.c` deliberately contains empty platform callbacks and no
entry point. The engine is in `third_party/doomgeneric/`; its public platform
interface is `doomgeneric.h`. Build scripts and browser integration are student
work. The supplied HTML does not yet load a compiled module.

Some details of this engine matter when implementing the browser port:

- **Pixels:** the default framebuffer is 640 by 400, with 32-bit pixels.
  Despite the `rgba8888` mode name, `i_video.c` packs red at bit 16, green at
  bit 8, and blue at bit 0, without setting alpha. On little-endian WebAssembly
  the bytes are B, G, R, 0. This is not directly usable as opaque RGBA canvas
  `ImageData`.
- **Timing:** `doomgeneric_Tick()` is callable, but screen wipes in `d_main.c`
  and tic synchronization in `d_loop.c` still contain clock/sleep waits.
  Browser integration must account for those waits and allow the browser to
  process events. The stub clock always returning zero cannot run the game.
- **Input:** the interface accepts Doom key codes and press/release events.
  Mouse event generation is commented out in the supplied `i_input.c`.
- **Files:** the engine reads the WAD with standard C file operations.
  Keeping `assets/doom1.wad` on the host does not itself make that file
  available inside the browser module. Packaging and runtime paths are part
  of the port. Save/config persistence across reloads is also separate work.
- **Audio:** sound is disabled by default. Enabling `FEATURE_SOUND` requires
  implementations of `DG_sound_module` and `DG_music_module` from `i_sound.h`;
  it also activates an `SDL_mixer.h` include in `i_sound.c`. The six callbacks
  in `doomgeneric.h` do not implement audio. A browser-native backend must
  account for that include if it does not use SDL mixer.

No additional sound assets are needed: the bundled WAD contains 55 sampled
sound effects, 13 MUS music scores, and GENMIDI instrument definitions.
Browser Web Audio can play decoded samples without external audio libraries.
Music needs sequencing and synthesis; the included `mus2mid.c` converts score
data but does not generate audio. Reproducing OPL-style instruments is a
larger task than playing sound effects. See the
[Web Audio specification](https://www.w3.org/TR/webaudio-1.0/).
