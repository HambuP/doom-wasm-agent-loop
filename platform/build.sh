#!/usr/bin/env bash
# Build the Doom WebAssembly port into dist/.
#
# Usage (from anywhere):  bash platform/build.sh
# Requires Emscripten 4.0.18 (emcc on PATH, or ~/Developer/emsdk, or $EMSDK).
#
# Output:
#   dist/index.html  (copied from web/index.html)
#   dist/doom.js     (Emscripten loader)
#   dist/doom.wasm   (engine + platform layer)
#   dist/doom.data   (preloaded assets/doom1.wad, mounted at /doom1.wad)
#   build/obj/       (intermediate object files)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REQUIRED_EMCC_VERSION="4.0.18"

if ! command -v emcc >/dev/null 2>&1; then
    for env in "${EMSDK:-}/emsdk_env.sh" "$HOME/Developer/emsdk/emsdk_env.sh"; do
        if [ -f "$env" ]; then
            # shellcheck disable=SC1090
            source "$env" >/dev/null 2>&1
            break
        fi
    done
fi

if ! command -v emcc >/dev/null 2>&1; then
    echo "error: emcc not found; install Emscripten $REQUIRED_EMCC_VERSION" >&2
    exit 1
fi

EMCC_VERSION="$(emcc --version | head -n1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
if [ "$EMCC_VERSION" != "$REQUIRED_EMCC_VERSION" ]; then
    echo "error: emcc $EMCC_VERSION found, $REQUIRED_EMCC_VERSION required" >&2
    exit 1
fi

ENGINE=third_party/doomgeneric
WAD=assets/doom1.wad
OUT=dist
OBJ=build/obj

# Engine sources: all of them. mus2mid.c's standalone main() is guarded by
# STANDALONE, and dummy.c supplies symbols the linker needs.
ENGINE_SOURCES=("$ROOT/$ENGINE"/*.c)
PLATFORM_SOURCE=platform/doomgeneric_wasm.c

CFLAGS=(
    -O2
    -I"$ROOT/$ENGINE"
    -DDOOMGENERIC_RESX=640
    -DDOOMGENERIC_RESY=400
)

# The supplied engine is read-only and warns a lot; silence it, but keep full
# warnings for our own platform layer.
ENGINE_CFLAGS=(-Wno-everything)
PLATFORM_CFLAGS=(-Wall -Wextra)

# Asyncify: DG_SleepMs calls emscripten_sleep. Inside the engine, every path
# to it is direct calls (doomgeneric_Tick -> TryRunTics/D_Display -> I_Sleep
# -> DG_SleepMs; D_DoomMain -> D_DoomLoop -> TryRunTics at startup), so
# indirect calls are ignored and only direct callers of the sleep are
# instrumented. The one indirect call on the path is the main loop calling
# frame() through the dynCall_v export, so dynCall_v is added explicitly;
# without it, rewinding calls dynCall_v with no function pointer
# ("RuntimeError: null function"). If a future sleep is reached through a
# function pointer, add the function that makes that call to ASYNCIFY_ADD.
# Set ASYNCIFY_ADVISE=1 to print the instrumented functions at link time.
ASYNCIFY_FLAGS=(
    -sASYNCIFY=1
    -sASYNCIFY_IGNORE_INDIRECT=1
    -sASYNCIFY_ADD=dynCall_v
    -sASYNCIFY_STACK_SIZE=65536
)
if [ "${ASYNCIFY_ADVISE:-0}" = 1 ]; then
    ASYNCIFY_FLAGS+=(-sASYNCIFY_ADVISE=1)
fi

LDFLAGS=(
    "${ASYNCIFY_FLAGS[@]}"
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=64MB
    -sSTACK_SIZE=1MB
    -sEXIT_RUNTIME=0
    -sEXPORTED_FUNCTIONS=_main,_doom_key_event
    -sEXPORTED_RUNTIME_METHODS=ccall,callMain,HEAPU8
    --preload-file "$WAD@/doom1.wad"
)

rm -rf "$OUT" "$OBJ"
mkdir -p "$OUT" "$OBJ/engine" "$OBJ/platform"

run() {
    echo "+ $*"
    "$@"
}

echo "emcc $EMCC_VERSION"

# emcc -c with several inputs writes <name>.o into the current directory.
(cd "$OBJ/engine" && run emcc -c "${CFLAGS[@]}" "${ENGINE_CFLAGS[@]}" "${ENGINE_SOURCES[@]}")
run emcc -c "${CFLAGS[@]}" "${PLATFORM_CFLAGS[@]}" "$PLATFORM_SOURCE" -o "$OBJ/platform/doomgeneric_wasm.o"
run emcc -O2 "$OBJ"/engine/*.o "$OBJ/platform/doomgeneric_wasm.o" "${LDFLAGS[@]}" -o "$OUT/doom.js"

cp web/index.html "$OUT/index.html"

echo "Built:"
ls -l "$OUT"
