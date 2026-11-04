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

# Engine sources: everything except mus2mid's standalone tool entry point
# (guarded by STANDALONE, so mus2mid.c itself is safe to compile).
SOURCES=()
for f in "$ENGINE"/*.c; do
    SOURCES+=("$f")
done
SOURCES+=(platform/doomgeneric_wasm.c)

CFLAGS=(
    -O2
    -I"$ENGINE"
    -DDOOMGENERIC_RESX=640
    -DDOOMGENERIC_RESY=400
    -Wno-everything
)

LDFLAGS=(
    -sASYNCIFY=1
    -sASYNCIFY_STACK_SIZE=65536
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=64MB
    -sSTACK_SIZE=1MB
    -sEXIT_RUNTIME=0
    -sEXPORTED_FUNCTIONS=_main,_doom_key_event
    -sEXPORTED_RUNTIME_METHODS=ccall,callMain,HEAPU8
    --preload-file "$WAD@/doom1.wad"
)

rm -rf "$OUT"
mkdir -p "$OUT"

CMD=(emcc "${CFLAGS[@]}" "${SOURCES[@]}" "${LDFLAGS[@]}" -o "$OUT/doom.js")

echo "emcc $EMCC_VERSION"
echo "+ ${CMD[*]}"
"${CMD[@]}"

cp web/index.html "$OUT/index.html"

echo "Built:"
ls -l "$OUT"
