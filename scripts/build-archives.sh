#!/bin/sh
set -eu
: "${EMSDK:?Emscripten 4.0.18 required}"
: "${LIBARCHIVE_SOURCE:?Verified libarchive 3.8.10 required}"
: "${XZ_SOURCE:?Verified XZ 5.8.2 required}"
: "${ZLIB_SOURCE:?Verified zlib 1.3.2 required}"
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TASK_BUILD=${SMALLER_NATIVE_BUILD:-/tmp/smaller-native-build}
export EM_CONFIG="$EMSDK/.emscripten"
export EM_CACHE="$EMSDK/upstream/emscripten/cache"
TASK_CMAKE="$EMSDK/upstream/emscripten/emcmake"
TASK_PREFIX="$TASK_BUILD/prefix"
mkdir -p "$TASK_BUILD" "$TASK_PREFIX"
"$TASK_CMAKE" cmake -S "$ZLIB_SOURCE" -B "$TASK_BUILD/zlib" -DCMAKE_BUILD_TYPE=Release -DZLIB_BUILD_SHARED=OFF -DZLIB_BUILD_STATIC=ON -DZLIB_BUILD_TESTING=OFF -DCMAKE_INSTALL_PREFIX="$TASK_PREFIX"
cmake --build "$TASK_BUILD/zlib" -j4
cmake --install "$TASK_BUILD/zlib"
"$TASK_CMAKE" cmake -S "$XZ_SOURCE" -B "$TASK_BUILD/xz" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF -DXZ_THREADS=no -DXZ_TOOL_XZ=OFF -DXZ_TOOL_XZDEC=OFF -DXZ_TOOL_LZMADEC=OFF -DXZ_TOOL_LZMAINFO=OFF -DXZ_DOC=OFF -DXZ_NLS=OFF -DCMAKE_INSTALL_PREFIX="$TASK_PREFIX"
cmake --build "$TASK_BUILD/xz" --target liblzma -j4
cmake --install "$TASK_BUILD/xz"
"$TASK_CMAKE" cmake -S "$LIBARCHIVE_SOURCE" -B "$TASK_BUILD/archive" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DENABLE_TEST=OFF -DENABLE_TAR=OFF -DENABLE_CPIO=OFF -DENABLE_CAT=OFF -DENABLE_UNZIP=OFF -DENABLE_OPENSSL=OFF -DENABLE_MBEDTLS=OFF -DENABLE_NETTLE=OFF -DENABLE_MD=OFF -DENABLE_CNG=OFF -DENABLE_LIBB2=OFF -DENABLE_LZ4=OFF -DENABLE_LZO=OFF -DENABLE_ZSTD=OFF -DENABLE_BZip2=OFF -DENABLE_LIBXML2=OFF -DENABLE_EXPAT=OFF -DENABLE_BSDXML=OFF -DENABLE_PCREPOSIX=OFF -DENABLE_PCRE2POSIX=OFF -DENABLE_ICONV=OFF -DENABLE_XATTR=OFF -DENABLE_ACL=OFF -DZLIB_INCLUDE_DIR="$TASK_PREFIX/include" -DZLIB_LIBRARY="$TASK_PREFIX/lib/libz.a" -DLIBLZMA_INCLUDE_DIR="$TASK_PREFIX/include" -DLIBLZMA_LIBRARY="$TASK_PREFIX/lib/liblzma.a" -DCMAKE_PREFIX_PATH="$TASK_PREFIX"
# Bind only the 7z writer's private scratch calls to our bounded memory bridge.
python3 - "$LIBARCHIVE_SOURCE/libarchive/CMakeLists.txt" <<'PATCH'
from pathlib import Path
import sys
p=Path(sys.argv[1]);marker='# Smaller memory-only 7z scratch binding'
s=p.read_text()
if marker not in s:
 s+='\n'+marker+'\nset_source_files_properties(archive_write_set_format_7zip.c PROPERTIES COMPILE_DEFINITIONS "__archive_mktemp=ds_tmp_create;read=ds_tmp_read;write=ds_tmp_write;lseek=ds_tmp_seek;close=ds_tmp_close")\n'
 p.write_text(s)
PATCH
cmake --build "$TASK_BUILD/archive" --target archive_static -j4
"$EMSDK/upstream/emscripten/emcc" "$TASK_ROOT/scripts/codec/archive.c" "$TASK_BUILD/archive/libarchive/libarchive.a" "$TASK_PREFIX/lib/liblzma.a" "$TASK_PREFIX/lib/libz.a" -I "$LIBARCHIVE_SOURCE/libarchive" -O2 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sABORTING_MALLOC=0 -sFILESYSTEM=0 -sEXPORTED_RUNTIME_METHODS=HEAPU8 -sEXPORTED_FUNCTIONS='["_ds_arc_open","_ds_arc_next","_ds_arc_entry_json","_ds_arc_read_chunk","_ds_arc_chunk_data","_ds_arc_error","_ds_arc_close","_ds_arc_writer_open","_ds_arc_writer_header","_ds_arc_writer_chunk","_ds_arc_writer_finish","_ds_arc_result_data","_ds_arc_result_size","_malloc","_free"]' -o "$TASK_ROOT/web/vendor/archive.js"
cp "$LIBARCHIVE_SOURCE/COPYING" "$TASK_ROOT/web/vendor/licenses/libarchive.txt"
cat "$XZ_SOURCE/COPYING" "$XZ_SOURCE/COPYING.0BSD" > "$TASK_ROOT/web/vendor/licenses/liblzma.txt"
cp "$ZLIB_SOURCE/LICENSE" "$TASK_ROOT/web/vendor/licenses/zlib.txt"

chmod 644 "$TASK_ROOT/web/vendor/archive.wasm"
