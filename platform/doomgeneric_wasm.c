// Your WebAssembly platform layer for doomgeneric.
//
// These are the functions doomgeneric expects a platform to provide
// (see third_party/doomgeneric/doomgeneric.h). Right now they do nothing,
// so the engine links but shows nothing and takes no input.
//
// There is also no main() yet. How the engine gets started and kept
// running in a browser is yours to design.
//
// Making this behave like Doom in a browser is the project.

#include <stdint.h>

#include "doomgeneric.h"

void DG_Init()
{
}

void DG_DrawFrame()
{
}

void DG_SleepMs(uint32_t ms)
{
    (void)ms;
}

uint32_t DG_GetTicksMs()
{
    return 0;
}

int DG_GetKey(int *pressed, unsigned char *key)
{
    (void)pressed;
    (void)key;
    return 0;
}

void DG_SetWindowTitle(const char *title)
{
    (void)title;
}
