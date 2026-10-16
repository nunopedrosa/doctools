#!/bin/sh
set -eu
: "${EMSDK:?Emscripten 4.0.18 required}"
: "${QPDF_SOURCE:?Verified QPDF 12.4.2 required}"
: "${JPEG_SOURCE:?libjpeg-turbo 3.1.2 required}"
: "${JPEG_BUILD:?Existing Emscripten libjpeg build required}"
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TASK_BUILD=${SMALLER_NATIVE_BUILD:-/tmp/smaller-native-build}
export EM_CONFIG="$EMSDK/.emscripten"
export EM_CACHE="$EMSDK/upstream/emscripten/cache"
PKG_CONFIG_LIBDIR= "$EMSDK/upstream/emscripten/emcmake" cmake -S "$QPDF_SOURCE" -B "$TASK_BUILD/qpdf" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DBUILD_STATIC_LIBS=ON -DBUILD_DOC=OFF -DUSE_IMPLICIT_CRYPTO=OFF -DREQUIRE_CRYPTO_NATIVE=ON -DUSE_INSECURE_RANDOM=OFF -DSKIP_OS_SECURE_RANDOM=ON -DSTATIC_JPEG=ON -DLIBJPEG_H_PATH="$JPEG_SOURCE/src" -DLIBJPEG_LIB_PATH="$JPEG_BUILD/libjpeg.a" -DZLIB_H_PATH="$TASK_BUILD/prefix/include" -DZLIB_LIB_PATH="$TASK_BUILD/prefix/lib/libz.a" -DCMAKE_CXX_FLAGS="-fexceptions -I$JPEG_BUILD" -DCMAKE_C_FLAGS="-fexceptions -I$JPEG_BUILD"
cmake --build "$TASK_BUILD/qpdf" --target libqpdf -j4
if [ -f "$TASK_ROOT/scripts/codec/pdf.cpp" ]; then
 "$EMSDK/upstream/emscripten/em++" "$TASK_ROOT/scripts/codec/pdf.cpp" "$TASK_BUILD/qpdf/libqpdf/libqpdf.a" "$TASK_BUILD/prefix/lib/libz.a" "$JPEG_BUILD/libjpeg.a" -I "$QPDF_SOURCE/include" -I "$TASK_BUILD/qpdf/include" -O2 -fexceptions -sDISABLE_EXCEPTION_CATCHING=0 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sABORTING_MALLOC=0 -sFILESYSTEM=0 -sEXPORTED_RUNTIME_METHODS=HEAPU8 -sEXPORTED_FUNCTIONS='["_ds_pdf_open","_ds_pdf_error","_ds_pdf_inspect","_ds_pdf_snapshot","_ds_pdf_image","_ds_pdf_replace","_ds_pdf_write","_ds_pdf_mapping","_ds_pdf_data","_ds_pdf_size","_ds_pdf_close","_malloc","_free"]' -o "$TASK_ROOT/web/vendor/pdf.js"
 cp "$QPDF_SOURCE/Artistic-2.0" "$TASK_ROOT/web/vendor/licenses/qpdf-artistic.txt"
 cp "$QPDF_SOURCE/LICENSE.txt" "$TASK_ROOT/web/vendor/licenses/qpdf.txt"
 chmod 644 "$TASK_ROOT/web/vendor/pdf.wasm"
fi
