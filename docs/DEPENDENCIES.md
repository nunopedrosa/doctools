# Runtime dependencies

All runtime dependencies are vendored under `web/vendor/`; there are no CDN imports. `vendor-manifest.json` records SHA-256 and byte length of every module/binary. npm package integrity and exact versions are in `package-lock.json`.

| Component | Version | License | Purpose |
| --- | --- | --- | --- |
| zip.js | 2.23.0 | BSD-3-Clause | Strict streamed ZIP reading and pass-through writing |
| jSquash OxiPNG | 2.3.0 | Apache-2.0 / MIT | Binary PNG optimization; single-thread wrapper only |
| jSquash PNG | 3.1.1 | Apache-2.0 / bundled codec license | Exact decoded PNG pixel comparison, including 16-bit samples |
| UPNG.js / pako | 2.1.0 / 1.0.11 | MIT / MIT and Zlib | Optional PNG palette reduction and deflate encoding |
| xmldom | 0.9.12 | MIT | Worker-compatible XML validation |
| libjpeg-turbo | 3.1.2 | BSD/IJG/zlib, see bundled license | Coefficient-preserving JPEG transcoding |
| Emscripten (maintainer only) | 4.0.18 | MIT and toolchain licenses | JPEG WebAssembly build |
| esbuild (maintainer only) | 0.28.2 | MIT | Bundle ZIP/XML without runtime package resolution |

Sources: [zip.js](https://github.com/gildas-lormeau/zip.js), [jSquash](https://github.com/jamsinclair/jSquash), [xmldom](https://github.com/xmldom/xmldom), [libjpeg-turbo](https://github.com/libjpeg-turbo/libjpeg-turbo/tree/3.1.2), [Emscripten SDK](https://github.com/emscripten-core/emsdk/tree/4.0.18).

Run `npm ci --ignore-scripts`, then `npm run vendor`. JPEG binaries are checked in. To rebuild them, acquire libjpeg-turbo 3.1.2 and Emscripten SDK 4.0.18, run `emsdk install 4.0.18` and `emsdk activate 4.0.18`, then `EMSDK=/path/to/emsdk JPEG_SOURCE=/path/to/libjpeg-turbo sh scripts/build-codecs.sh` and `npm run vendor`.

The default C wrapper reads existing quantized DCT coefficients and writes those same coefficients with optimized entropy encoding. It copies APP/COM markers and disables synthesized JFIF/Adobe markers. It tries sequential and progressive encoding and retains the smallest candidate. The optional `recompress_jpeg` function decodes supported 8-bit YCbCr/grayscale images through scanline buffers and re-encodes at a selected quality, retaining dimensions and component sampling. RGB-coded, CMYK and non-8-bit JPEG variants receive conservative fallback. JPEG metadata verification walks every scan; original APP/COM markers encountered after baseline scanlines are restored before EOI when the native output omits them. The original coefficient-preserving path remains unchanged.

The PNG adapter uses single-threaded OxiPNG with alpha optimization disabled. It accepts representation changes only after decoding both images with the bundled jSquash PNG decoder and comparing every unpremultiplied RGBA sample exactly. It uses 16-bit decoding whenever either representation is 16-bit. Candidate IHDR, PLTE, tRNS and IDAT are kept together; other original metadata payloads are preserved. Representation-dependent metadata, incompatible ICC color-model changes and unknown unsafe-to-copy chunks cause conservative fallback. The extra decoder module/binary adds approximately 185 KiB plus licenses and requires additional bounded per-image decoding memory and CPU; files near the published ceilings still need device-specific benchmarking.

Independent tests use Pillow 12.3.0 and the installed native `jpegtran` to compare raw pixels and canonical coefficient-preserving JPEG output. Test tools are not shipped to browsers.

The optional PNG color mode uses [UPNG.js](https://github.com/photopea/UPNG.js) with its pako dependency, bundled into one local module. The module and licenses add approximately 65 KiB. The module loads for execution only when color mode is selected and is included in the offline cache. Quantization runs in the existing worker without browser canvas color conversion, threads or network services. A separate 4-megapixel ceiling bounds its extra pixel arrays and quantization work. Previews retain the current result in worker memory and read only one original/result image pair at a time. Maximum-size memory behavior still needs device-specific verification.

Optional JPEG recompression reuses the pinned libjpeg-turbo build and adds no dependency. The WebAssembly payload grows from 286,561 to 542,365 bytes because full pixel decoding/encoding is now linked, rather than only coefficient transcoding. It stays single-threaded, local and offline, with the existing 512 MiB WASM memory ceiling and 25-megapixel image ceiling. The input/output file routing module is worker-owned; the main page imports only lightweight file-type/MIME selection. Browser canvas encoders are not used, preserving metadata and avoiding browser-specific encoding/color conversion behavior.

Source archive SHA-256 values used for the checked-in JPEG build:

```text
560f6338b547544c4f9721b18d8b87685d433ec78b3c644c70d77adad22c55e6  libjpeg-turbo-3.1.2.tar.gz
581a7ae0c0b4207fd26eb0b609d9df9fb5be1c2d451ed5cebb5479ebbcee6ae3  emsdk-4.0.18.tar.gz
```

Acquire the source archives from the official GitHub repositories' `refs/tags/3.1.2.tar.gz` and `refs/tags/4.0.18.tar.gz` URLs respectively, and verify these hashes before rebuilding. Emscripten resolves SDK 4.0.18 to upstream build `df7d4d811503e86e7728326e3eabbc383cb8042d`.

The offline asset set with exact PNG verification and optional PNG/JPEG quality reduction is approximately 1.33 MiB uncompressed, including licenses and icons. A content digest in the release identifier changes whenever runtime content changes. The service worker verifies SHA-256 of fetched assets and only accepts a matching complete release. Test dependencies additionally include pinned Playwright 1.62.1, Pillow 12.3.0 and python-docx 1.2.0. The independent native JPEG oracle used libjpeg-turbo 3.2.0.

The bundled jSquash codec identifies upstream OxiPNG v3.0.0 in its codec README. Its MIT attribution is preserved in `web/vendor/licenses/oxipng-upstream.txt`, acquired from the official tagged source.

## Native archive engine (multi-format development)

libarchive 3.8.10 is built from verified upstream source with liblzma from XZ 5.8.2 (0BSD) and zlib 1.3.2 (zlib license). The planned zlib 1.3.1 candidate was replaced because 1.3.2 includes upstream audit fixes; the published zlib.net SHA-256 was checked before extraction. Source URLs, release metadata and SHA-256 values are pinned in `scripts/native-sources.lock.json`. The libarchive, XZ and QPDF source archive hashes were matched to GitHub's published release asset digests; this is checksum provenance, not a claim of local GPG verification. Bundled notices include the actual liblzma 0BSD text and libarchive's component notices.

Rebuild with Emscripten 4.0.18 using `EMSDK`, `LIBARCHIVE_SOURCE`, `XZ_SOURCE`, `ZLIB_SOURCE` and `sh scripts/build-archives.sh`. Supply the verified extracted versions from the lock file; scripts do not download source implicitly. The build links only required formats/codecs through explicit reader/writer registration and linker dead-code elimination; tools, host crypto, external filters and filesystem extraction are excluded.

The 7z writer's translation unit maps its internal temporary-file functions to private seekable memory buffers in `scripts/codec/archive.c`. This reproducible CMake binding is in the build script; it preserves `FILESYSTEM=0` without host/browser file access. Scratch capacities are capped cumulatively at 250 MiB, freed on close and included within the 512 MiB native memory ceiling. Output also has a 250 MiB cap. Unsupported metadata/features cause rejection; RAR data CRCs are independently checked on decoded chunks because the backend's stored RAR4 EOF path did not reliably reject a corrupted payload. Header preflights reject multipart/encrypted RAR, unknown-size or nonempty CRC-less RAR entries, unpreservable TAR PAX fields, links and hidden TAR trailing data. A RAR compression dictionary above 256 MiB is rejected before decoding.

The archive WASM is approximately 381 KiB plus a small ES module and licenses; exact bytes/hashes are recorded in vendor-manifest.json. Two consecutive native builds produced byte-identical WASM. This is behavioral and repeat-build evidence on the development machine, not an independent compiler audit. Native unit fixtures cover stored/compressed RAR4, stored/compressed/solid RAR5, TAR/PAX and 7z, Unicode paths, metadata round trips and failure cases. Public format activation is separate from engine availability.
