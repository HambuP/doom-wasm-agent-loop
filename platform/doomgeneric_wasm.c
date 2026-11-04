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
// - Frames: the engine writes 0x00RRGGBB pixels (bytes B,G,R,0 in memory).
//   DG_DrawFrame converts them to opaque RGBA and blits with putImageData.
// - Input: JavaScript (web/index.html) translates browser keys to Doom key
//   codes and calls doom_key_event(); DG_GetKey drains a ring buffer.

#include <stdint.h>
#include <stdio.h>

#include <emscripten.h>
#include <emscripten/html5.h>

#include "doomgeneric.h"

#define TICRATE 35

#define KEYQUEUE_SIZE 64

static uint16_t key_queue[KEYQUEUE_SIZE];
static unsigned int key_queue_write;
static unsigned int key_queue_read;

static uint8_t rgba_buffer[DOOMGENERIC_RESX * DOOMGENERIC_RESY * 4];

static double start_time_ms;
static uint32_t last_tick_tic = UINT32_MAX;

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

    key_queue[key_queue_write] = (uint16_t)((pressed ? 0x100 : 0) | key);
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
    // Run the engine only when a new game tic is due. Otherwise TryRunTics
    // would wait (sleep) inside the frame for the next tic.
    uint32_t tic = (uint32_t)((uint64_t)DG_GetTicksMs() * TICRATE / 1000);

    if (tic == last_tick_tic)
    {
        return;
    }

    last_tick_tic = tic;
    doomgeneric_Tick();
}

int main(int argc, char **argv)
{
    static char *doom_argv[] = { "doom", "-iwad", "/doom1.wad", NULL };

    (void)argc;
    (void)argv;

    doomgeneric_Create(3, doom_argv);

    emscripten_set_main_loop(frame, 0, 1);

    return 0;
}
