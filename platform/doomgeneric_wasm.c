// WebAssembly platform layer for doomgeneric.
//
// Implements the six DG_* callbacks from third_party/doomgeneric/doomgeneric.h
// and the browser entry point.
//
// Design:
// - main() creates the engine, then hands control to the browser with
//   emscripten_set_main_loop(), which calls doomgeneric_Tick() at most once
//   per animation frame and only when a new 35 Hz game tic is due.
// - The engine's wait loops (screen wipe in d_main.c, tic sync in d_loop.c)
//   call I_Sleep -> DG_SleepMs. The build uses ASYNCIFY so DG_SleepMs can
//   yield to the browser with emscripten_sleep(); the wipe animates instead
//   of freezing the page, and the clock keeps advancing.
// - While a sleep is suspended, Emscripten pauses the main loop (libasync.js
//   calls MainLoop.pause() on unwind and MainLoop.resume() on rewind), so
//   frame() should never be re-entered mid-Tick. frame() still guards against
//   it and counts any re-entry in window.doomTickReentries.
// - Quit/fatal error: the engine's I_Quit runs its exit functions and then
//   returns (exit() is compiled out), and I_Error calls exit(-1), which does
//   not stop the main loop. An I_AtExit handler stops the main loop and tells
//   the page (window.doomExited, Module.onDoomExit).
// - Frames: the engine writes 0x00RRGGBB pixels (bytes B,G,R,0 in memory).
//   DG_DrawFrame converts them to opaque RGBA and blits with putImageData.
// - Input: JavaScript (web/index.html) translates browser keys to Doom key
//   codes and calls doom_key_event(); DG_GetKey drains a ring buffer.

#include <stdint.h>
#include <stdio.h>

#include <emscripten.h>
#include <emscripten/html5.h>

#include "doomgeneric.h"
#include "i_system.h"

// Must match TICRATE in third_party/doomgeneric/doomdef.h; frame() uses it to
// mirror I_GetTime()'s tic count.
#define TICRATE 35

#define KEYQUEUE_SIZE 64

static uint16_t key_queue[KEYQUEUE_SIZE];
static unsigned int key_queue_write;
static unsigned int key_queue_read;

static uint8_t rgba_buffer[DOOMGENERIC_RESX * DOOMGENERIC_RESY * 4];

static double start_time_ms;
static uint32_t last_tick_tic = UINT32_MAX;

// Nonzero while doomgeneric_Tick() is on the stack, including while it is
// suspended in DG_SleepMs.
static int in_tick;
static unsigned int tick_reentries;
static int engine_exited;

// Called from JavaScript for every key press and release. key is a Doom key
// code (doomkeys.h or lowercase ASCII). Events are dropped if the queue is
// full rather than overwriting unread ones.
EMSCRIPTEN_KEEPALIVE
void doom_key_event(int pressed, int key)
{
    unsigned int next = (key_queue_write + 1) % KEYQUEUE_SIZE;

    if (key <= 0 || key > 0xff || next == key_queue_read)
    {
        return;
    }

    key_queue[key_queue_write] = (uint16_t)(pressed ? 0x100 : 0 | key);
    key_queue_write = next;
}

void DG_Init()
{
    start_time_ms = emscripten_get_now();

    EM_ASM({
        var canvas = document.getElementById('canvas');
        canvas.width = $0;
        canvas.height = $1;
        Module.doomCtx = canvas.getContext('2d');
        Module.doomImage = Module.doomCtx.createImageData($0, $1);
        window.doomFrameCount = 0;
        window.doomReady = false;
        window.doomTickReentries = 0;
        window.doomExited = false;
    }, DOOMGENERIC_RESX, DOOMGENERIC_RESY);
}

void DG_DrawFrame()
{
    const uint32_t *src = DG_ScreenBuffer;
    uint8_t *dst = rgba_buffer;
    int i;

    for (i = 0; i < DOOMGENERIC_RESX * DOOMGENERIC_RESY; ++i)
    {
        uint32_t p = src[i];
        dst[0] = (p >> 16) & 0xff;
        dst[1] = (p >> 8) & 0xff;
        dst[2] = p & 0xff;
        dst[3] = 0xff;
        dst += 4;
    }

    EM_ASM({
        var image = Module.doomImage;
        image.data.set(HEAPU8.subarray($0, $0 + $1));
        Module.doomCtx.putImageData(image, 0, 0);
        window.doomFrameCount = (window.doomFrameCount | 0) + 1;
        window.doomReady = true;
    }, rgba_buffer, sizeof(rgba_buffer));
}

void DG_SleepMs(uint32_t ms)
{
    // Yield to the browser (requires -sASYNCIFY) so that event handling,
    // painting and the clock all advance while the engine waits.
    emscripten_sleep(ms);
}

uint32_t DG_GetTicksMs()
{
    return (uint32_t)(emscripten_get_now() - start_time_ms);
}

int DG_GetKey(int *pressed, unsigned char *key)
{
    uint16_t ev;

    if (key_queue_read == key_queue_write)
    {
        return 0;
    }

    ev = key_queue[key_queue_read];
    key_queue_read = (key_queue_read + 1) % KEYQUEUE_SIZE;

    *pressed = (ev & 0x100) != 0;
    *key = ev & 0xff;
    return 1;
}

void DG_SetWindowTitle(const char *title)
{
    EM_ASM({ document.title = UTF8ToString($0); }, title);
}

static void frame(void)
{
    uint32_t tic;

    if (engine_exited)
    {
        return;
    }

    // A Tick suspended in DG_SleepMs must finish before another starts;
    // running the engine re-entrantly would corrupt its state.
    if (in_tick)
    {
        ++tick_reentries;
        fprintf(stderr, "doom: frame() re-entered during a Tick (%u)\n",
                tick_reentries);
        EM_ASM({ window.doomTickReentries = $0; }, tick_reentries);
        return;
    }

    // Run the engine only when a new game tic is due. Otherwise TryRunTics
    // would wait (sleep) inside the frame for the next tic.
    tic = (uint32_t)((uint64_t)DG_GetTicksMs() * TICRATE / 1000);

    if (tic == last_tick_tic)
    {
        return;
    }

    last_tick_tic = tic;

    in_tick = 1;
    doomgeneric_Tick();
    in_tick = 0;
}

// Registered with I_AtExit, so it runs on Quit Game (I_Quit) and on fatal
// errors (I_Error) before the engine's own exit handling.
static void on_engine_exit(void)
{
    if (engine_exited)
    {
        return;
    }

    engine_exited = 1;
    emscripten_cancel_main_loop();

    EM_ASM({
        window.doomExited = true;
        if (Module.onDoomExit) {
            Module.onDoomExit();
        }
    });
}

int main(int argc, char **argv)
{
    static char *doom_argv[] = { "doom", "-iwad", "/doom1.wad", NULL };

    (void)argc;
    (void)argv;

    // Exit functions run newest first. Registering before Create covers
    // fatal errors during startup; registering again after Create makes the
    // handler run before D_Endoom, which calls exit(0) on Quit Game.
    I_AtExit(on_engine_exit, true);
    doomgeneric_Create(3, doom_argv);
    I_AtExit(on_engine_exit, true);

    emscripten_set_main_loop(frame, 0, 1);

    return 0;
}