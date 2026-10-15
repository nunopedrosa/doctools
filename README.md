# Doctools

Reduce embedded PNG and JPEG image sizes in a DOCX without resizing. Choose exact lossless optimization or optional PNG color reduction with a before/after preview. Processing runs on your device. The PWA downloads a separate optimized document and keeps the original untouched.

## Run locally

The finished app and all dependencies are checked in. No installation, build, account, or application server is required:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory web
```

Open [Doctools locally](http://127.0.0.1:8000/). Use the same port for later visits so the browser uses the same site storage. Directly opening `index.html` with `file://` does not support the offline workflow.

1. Select or drop one DOCX and wait for its image summary.
2. Keep **Exact lossless** to preserve every pixel, or choose **Reduce PNG colors** and a maximum palette size (128 colors by default; 64 or 32 can yield smaller files with more visible changes).
3. Optimize, review the image report, and use **Preview** beside each color-reduced image. Compare the original and result at fit size or **100% — actual pixels**, with synchronized scrolling. Download the new `name-compressed.docx` if the document became smaller. Changing mode or palette size clears the old result; optimize again to apply it.
4. Choose **Clear** to release the current document and result. **Cancel** stops processing; select a document to start again.

If the complete package does not shrink, the app retains the original bytes and reports no reduction. It does not offer an unchanged file as a compressed download.

## Offline use and installation

Keep the page open until **Ready offline** appears. This confirms that the app controls the page and has cached its interface, worker and both image optimizers. You can then reopen the same address and process new documents offline. Browser cache eviction or clearing site data removes offline availability; reconnect to the local server and reload to repair missing assets.

Install from Chrome/Edge's app installation menu, or Safari's **File → Add to Dock** on Mac. Installation is optional; browser use has the same processing features. Firefox can use the offline browser app, with installation options depending on platform.

Updates wait until you choose **Update app**. Finish or cancel processing in all open Doctools windows first. The app checks and locks idle windows, then reloads them together. A failed download of an update leaves the active release available. Offline readiness is checked separately from connection status.

You can also host the contents of `web/` on an HTTPS static site. Serve `.wasm` as `application/wasm` and `.js` as JavaScript. Keep the whole release together, including vendor binaries and licenses; keep repository documentation, tests and `.git` outside the web root. No hosting destination has been configured or deployed.

## Preservation and limits

Only existing PNG and JPEG images under `word/media/` are candidates for optimization. Both modes preserve image filenames, extensions, dimensions, metadata and transparency. JPEG processing always preserves the original quantized coefficients. In exact lossless mode, PNG processing compares every decoded pixel, including transparency and 16-bit samples. Lossless changes such as removing an unused alpha channel or using an exact palette are allowed. Unsupported variants, animated PNGs and other formats stay unchanged, with a reason in the report.

Optional color reduction replaces PNG colors with a palette of up to 32, 64, 128 or 256 colors. RGB values can change visibly, particularly in gradients, photographs and fine text. This mode is perceptual compression; the preview helps you judge quality but cannot guarantee invisible differences. Each alpha sample is verified unchanged. It supports static PNGs with up to 8-bit samples and 4 megapixels; larger images, 16-bit PNGs, representation-dependent metadata and candidates that alter transparency fall back to lossless processing. The smaller of the original, lossless and accepted color-reduced candidates is used. Color-reduced previews load one pair at a time and release their object URLs on close, settings changes, clearing or navigation.

All other package parts, including XML, relationships, comments, tracked changes, headers/footers and embedded objects, retain identical extracted bytes. ZIP container bytes and offsets can change. Output is reopened and checked before a download is offered.

Strict lossless optimization can save little on already optimized documents. Savings depend on the images and ZIP compression. On the supplied 499,645-byte PNG, exact lossless saves 32.0%; color reduction saves 85.4% at 128 colors or 88.7% at 64 colors, at the original 597 × 1067 dimensions. LightImage's supplied result saves 88.2%, with a different 30-color palette. These are one-image measurements, not a guarantee for other images or whole documents. No resizing, metadata stripping or format conversion is performed.

- Input: up to 100 MiB; one DOCX at a time.
- Expanded package: up to 250 MiB and 5,000 entries.
- Each expanded entry: up to 50 MiB.
- Images above 25 megapixels: retained unchanged.
- Password-protected, encrypted, signed, malformed or unsupported packages: rejected with an explanation.

Large documents need more memory than their file size. Limits are protective ceilings, not a guarantee that every device can process a maximum-size file. Cancellation keeps the original intact.

Target desktop browsers: Safari 17+, Chrome/Edge 120+, Firefox 121+. See [actual verification](docs/VERIFICATION.md) for tested versions and gaps. Small-screen layout is supported; large-document mobile processing is not verified.

## Privacy

No document uploads, tracking, analytics, accounts or cloud services. Documents and results stay in memory; only application assets are cached. There is no saved document history. Browser storage belongs to the particular browser, device and origin, and can be cleared. Keep your original files as your canonical copies.

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
