# Doctools

Compress DOCX files or individual PNG/JPEG images without resizing. Choose exact lossless optimization or optional PNG color/JPEG quality reduction with a before/after preview. Processing runs on your device. The PWA downloads a separate optimized file and keeps the original untouched.

## Run locally

The finished app and all dependencies are checked in. No installation, build, account, or application server is required:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory web
```

Open [Doctools locally](http://127.0.0.1:8000/). Use the same port for later visits so the browser uses the same site storage. Directly opening `index.html` with `file://` does not support the offline workflow.

1. Select or drop one DOCX, PNG or JPEG and wait for its summary.
2. Keep **Exact lossless** for the original quality, or choose **Smaller file (quality reduction)**. For PNGs, select a palette size (128 by default). For JPEGs, select an encoder quality (70 by default; higher values keep more detail). DOCX files show both controls for embedded images.
3. Optimize, review the image report, and choose **Preview** for quality-reduced images or a changed standalone image. Compare at fit size or **100% — actual pixels**, with synchronized scrolling. Download `name-compressed.docx`, `.png`, `.jpg` or `.jpeg` if the result is smaller. Changing mode or settings clears the old result; optimize again to apply the change.
4. Choose **Clear** to release the current file and result. **Cancel** stops processing; select a file to start again.

If the complete package does not shrink, the app retains the original bytes and reports no reduction. It does not offer an unchanged file as a compressed download.

## Offline use and installation

Keep the page open until **Ready offline** appears. This confirms that the app controls the page and has cached its interface, worker and image codecs. You can then reopen the same address and process new documents or standalone images offline. Browser cache eviction or clearing site data removes offline availability; reconnect to the local server and reload to repair missing assets.

Install from Chrome/Edge's app installation menu, or Safari's **File → Add to Dock** on Mac. Installation is optional; browser use has the same processing features. Firefox can use the offline browser app, with installation options depending on platform.

Updates wait until you choose **Update app**. Finish or cancel processing in all open Doctools windows first. The app checks and locks idle windows, then reloads them together. A failed download of an update leaves the active release available. Offline readiness is checked separately from connection status.

The production target is [smaller.basecentral.link](https://smaller.basecentral.link/), using the same DreamHost account as Agenda. The production release is deployed with trusted HTTPS; live Chromium checks verify offline DOCX, PNG and JPEG processing and image previews. See [deployment and rollback instructions](docs/DEPLOYMENT.md) for the exact paths, DNS, cache headers and verification command. Keep the whole release together, including vendor binaries and licenses; keep repository documentation, tests and `.git` outside the web root.

## Preservation and limits

For DOCX, only existing PNG and JPEG images under `word/media/` are candidates for optimization. Individual PNG/JPEG files use the same image engine. Both modes preserve image formats, dimensions, metadata, orientation and transparency; paths inside DOCX also stay unchanged. In exact lossless mode, JPEG processing preserves quantized coefficients and PNG processing compares every decoded pixel, including transparency and 16-bit samples. Lossless changes such as removing an unused alpha channel or using an exact palette are allowed. Unsupported variants, animated PNGs and other embedded formats stay unchanged, with a reason in the report.

Optional PNG color reduction uses a palette of up to 32, 64, 128 or 256 colors. RGB values can change visibly, particularly in gradients, photographs and fine text. Each alpha sample is verified unchanged. It supports static PNGs with up to 8-bit samples and 4 megapixels; larger images, 16-bit PNGs, representation-dependent metadata and candidates that alter transparency fall back to lossless processing.

Optional JPEG quality reduction decodes and re-encodes supported 8-bit grayscale/YCbCr JPEGs at the selected quality. It keeps the original dimensions, sampling, orientation and APP/COM metadata. Quality 70 is an encoder parameter, not a guarantee of 70% visual quality. Unsupported color spaces, including CMYK and RGB-coded JPEGs, use the existing lossless/unchanged fallback. JPEGs can lose fine detail; preview text and textures before downloading.

Both optional methods change pixel values. Previews help you judge quality but cannot guarantee invisible differences. The smallest of the original, lossless and accepted quality-reduced candidates is used. Previews load one pair at a time and release their object URLs on close, settings changes, clearing or navigation.

All other package parts, including XML, relationships, comments, tracked changes, headers/footers and embedded objects, retain identical extracted bytes. ZIP container bytes and offsets can change. Output is reopened and checked before a download is offered.

Strict lossless optimization can save little on already optimized documents. Savings depend on the images and ZIP compression. On the supplied 499,645-byte PNG, exact lossless saves 32.0%; color reduction saves 85.4% at 128 colors or 88.7% at 64 colors, at the original 597 × 1067 dimensions. LightImage's supplied result saves 88.2%, with a different 30-color palette. These are one-image measurements, not a guarantee for other images or whole documents. No resizing, metadata stripping or format conversion is performed.

On the supplied 2,036,321-byte JPEG, quality 70 produces 808,996 bytes (60.3% smaller), close to LightImage's 790,030 bytes (61.2% smaller). Both retain 2160 × 3840 dimensions. The app retains the original APP/COM metadata byte-for-byte. Exact lossless optimization of that image saves 9.8%.

- Input: up to 100 MiB; one DOCX at a time.
- Standalone PNG/JPEG: up to 50 MiB and 25 megapixels; one image at a time.
- Expanded package: up to 250 MiB and 5,000 entries.
- Each expanded entry: up to 50 MiB.
- Images above 25 megapixels: retained unchanged.
- Password-protected, encrypted, signed, malformed or unsupported packages: rejected with an explanation.

Large documents need more memory than their file size. Limits are protective ceilings, not a guarantee that every device can process a maximum-size file. Cancellation keeps the original intact.

Target desktop browsers: Safari 17+, Chrome/Edge 120+, Firefox 121+. See [actual verification](docs/VERIFICATION.md) for tested versions and gaps. Small-screen layout is supported; large-document mobile processing is not verified.

## Privacy

No file uploads, tracking, analytics, accounts or cloud services. Documents, standalone images and results stay in memory; only application assets are cached. There is no saved file history. Browser storage belongs to the particular browser, device and origin, and can be cleared. Keep your original files as your canonical copies.

## Development and checks

Node.js 22+ and Python 3 are used for maintenance and testing only. Dependency versions, licenses, hashes and codec rebuild steps are in [dependencies](docs/DEPENDENCIES.md). Tests require Pillow, python-docx, native `jpegtran`, Playwright and Chromium. Existing bundled workspace tools can be selected with `DOCTOOLS_PYTHON`, `DOCTOOLS_PLAYWRIGHT` and `DOCTOOLS_CHROMIUM`.

```sh
npm ci --ignore-scripts
npm run vendor
python3 -m pip install -r scripts/requirements-test.txt
python3 scripts/fixtures.py
npm test
npm run test:browser
python3 scripts/image-oracle.py tests/fixtures tests/output/codecs
```

If using a separate Python environment, set `DOCTOOLS_PYTHON` to its interpreter before `npm test`. The test scripts can use the Codex bundled runtimes when available. Install a compatible Playwright Chromium with `npx playwright install chromium` when a bundled browser is unavailable. The browser suite starts its own loopback server, uses isolated contexts, and writes screenshots/downloads under ignored `tests/output/`.

After changing runtime assets, regenerate the release inventory with `npm run release`. Its content digest changes the cache identity automatically, including changes to the service worker. `npm run release -- 2026.10.15.2` optionally changes the human-readable release label. The static tests reject stale hashes. `npm run vendor` also regenerates the release inventory.

## Original command-line workflow

The shell tools remain available on macOS:

```sh
./docx-unpack example.docx
```

This creates `example_docx/`. Optimize images in `example_docx/word/media/` with LightImage, keeping every filename and extension exactly the same. Then run:

```sh
./docx-pack example.docx example_docx
```

This creates `example-compressed.docx`, copying the original archive and updating image entries. It refuses to overwrite an existing output. The original DOCX stays untouched. The PWA adds stricter validation and output-preservation checks; the CLI retains its existing behavior.
