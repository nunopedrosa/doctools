#!/bin/sh
set -eu
# Install Emscripten 4.0.18 separately. Set EMSDK and JPEG_SOURCE to existing pinned trees.
: "${EMSDK:?Path to Emscripten SDK 4.0.18 required}"
: "${JPEG_SOURCE:?Path to libjpeg-turbo 3.1.2 required}"
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TASK_BUILD=${TMPDIR:-/tmp}/doctools-jpeg-build
export EM_CONFIG="$EMSDK/.emscripten"
export EM_CACHE="$EMSDK/upstream/emscripten/cache"
"$EMSDK/upstream/emscripten/emcmake" cmake -S "$JPEG_SOURCE" -B "$TASK_BUILD" -DENABLE_SHARED=OFF -DENABLE_STATIC=ON -DWITH_SIMD=OFF -DWITH_TURBOJPEG=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build "$TASK_BUILD" --target jpeg-static -j 4
"$EMSDK/upstream/emscripten/emcc" "$TASK_ROOT/scripts/codec/jpeg.c" "$TASK_BUILD/libjpeg.a" -I "$JPEG_SOURCE/src" -I "$TASK_BUILD" -O2 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORTED_RUNTIME_METHODS=HEAPU8 -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sEXPORTED_FUNCTIONS='["_optimize_jpeg","_recompress_jpeg","_result_data","_result_size","_malloc","_free"]' -o "$TASK_ROOT/web/vendor/jpeg.js"
cp "$JPEG_SOURCE/LICENSE.md" "$TASK_ROOT/web/vendor/licenses/libjpeg-turbo.txt"
