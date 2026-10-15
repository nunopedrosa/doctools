# Runtime dependencies

All runtime dependencies are vendored under `web/vendor/`; there are no CDN imports. `vendor-manifest.json` records SHA-256 and byte length of every module/binary. npm package integrity and exact versions are in `package-lock.json`.

| Component | Version | License | Purpose |
| --- | --- | --- | --- |
| zip.js | 2.23.0 | BSD-3-Clause | Strict streamed ZIP reading and pass-through writing |
| jSquash OxiPNG | 2.3.0 | Apache-2.0 / MIT | Binary PNG optimization; single-thread wrapper only |
| jSquash PNG | 3.1.1 | Apache-2.0 / bundled codec license | Exact decoded PNG pixel comparison, including 16-bit samples |
| xmldom | 0.9.12 | MIT | Worker-compatible XML validation |
| libjpeg-turbo | 3.1.2 | BSD/IJG/zlib, see bundled license | Coefficient-preserving JPEG transcoding |
| Emscripten (maintainer only) | 4.0.18 | MIT and toolchain licenses | JPEG WebAssembly build |
| esbuild (maintainer only) | 0.28.2 | MIT | Bundle ZIP/XML without runtime package resolution |

Sources: [zip.js](https://github.com/gildas-lormeau/zip.js), [jSquash](https://github.com/jamsinclair/jSquash), [xmldom](https://github.com/xmldom/xmldom), [libjpeg-turbo](https://github.com/libjpeg-turbo/libjpeg-turbo/tree/3.1.2), [Emscripten SDK](https://github.com/emscripten-core/emsdk/tree/4.0.18).

Run `npm ci --ignore-scripts`, then `npm run vendor`. JPEG binaries are checked in. To rebuild them, acquire libjpeg-turbo 3.1.2 and Emscripten SDK 4.0.18, run `emsdk install 4.0.18` and `emsdk activate 4.0.18`, then `EMSDK=/path/to/emsdk JPEG_SOURCE=/path/to/libjpeg-turbo sh scripts/build-codecs.sh` and `npm run vendor`.

The C wrapper reads existing quantized DCT coefficients and writes those same coefficients with optimized entropy encoding. It copies APP/COM markers and disables synthesized JFIF/Adobe markers. It tries sequential and progressive encoding and retains the smallest candidate. No geometric transforms or quality changes are available. CMYK and non-8-bit variants are preserved without optimization.

The PNG adapter uses single-threaded OxiPNG with alpha optimization disabled. It accepts representation changes only after decoding both images with the bundled jSquash PNG decoder and comparing every unpremultiplied RGBA sample exactly. It uses 16-bit decoding whenever either representation is 16-bit. Candidate IHDR, PLTE, tRNS and IDAT are kept together; other original metadata payloads are preserved. Representation-dependent metadata, incompatible ICC color-model changes and unknown unsafe-to-copy chunks cause conservative fallback. The extra decoder module/binary adds approximately 185 KiB plus licenses and requires additional bounded per-image decoding memory and CPU; files near the published ceilings still need device-specific benchmarking.

Independent tests use Pillow 12.3.0 and the installed native `jpegtran` to compare raw pixels and canonical coefficient-preserving JPEG output. Test tools are not shipped to browsers.

Source archive SHA-256 values used for the checked-in JPEG build:

```text
560f6338b547544c4f9721b18d8b87685d433ec78b3c644c70d77adad22c55e6  libjpeg-turbo-3.1.2.tar.gz
581a7ae0c0b4207fd26eb0b609d9df9fb5be1c2d451ed5cebb5479ebbcee6ae3  emsdk-4.0.18.tar.gz
```

Acquire the source archives from the official GitHub repositories' `refs/tags/3.1.2.tar.gz` and `refs/tags/4.0.18.tar.gz` URLs respectively, and verify these hashes before rebuilding. Emscripten resolves SDK 4.0.18 to upstream build `df7d4d811503e86e7728326e3eabbc383cb8042d`.

The offline asset set with exact PNG verification is approximately 1.0 MiB uncompressed, including licenses and icons. A content digest in the release identifier changes whenever runtime content changes. The service worker verifies SHA-256 of fetched assets and only accepts a matching complete release. Test dependencies additionally include pinned Playwright 1.62.1, Pillow 12.3.0 and python-docx 1.2.0. The independent native JPEG oracle used libjpeg-turbo 3.2.0.

The bundled jSquash codec identifies upstream OxiPNG v3.0.0 in its codec README. Its MIT attribution is preserved in `web/vendor/licenses/oxipng-upstream.txt`, acquired from the official tagged source.
