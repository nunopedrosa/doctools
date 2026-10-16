# Doctools verification

Verification date: 2026-10-16. Local application checks and final hosted HTTPS/offline checks passed. See [the deployment record](DEPLOYMENT.md).

## Hosted verification

`node tests/live.mjs https://smaller.basecentral.link/` passed against runtime `2026.10.16.1-021043170764` in Chromium 153.0.8010.12. All 42 public runtime assets matched local SHA-256 hashes, with correct MIME types and `no-cache` headers. Private repository/configuration paths were inaccessible. Public TLS and direct-origin TLS both validated normally.

A fresh browser reached **Ready offline**, disconnected, reopened the page, and compressed synthetic standalone JPEG, PNG and DOCX files. Downloads were smaller; standalone outputs matched the local codec results and before/after previews loaded. Only app assets appeared in Cache Storage; recorded app requests contained no uploads or external destinations. Screenshots and outputs are in ignored `tests/output/live/`. This does not establish physical-device or installed-PWA compatibility.

## Automated checks

- `npm test`: 68 passing tests covering codec preservation, DOCX round trips, unsafe/corrupt/unsupported archives, encrypted and signed input, entity declarations, UTF16 XML, Strict OOXML namespaces, relationship resolution, limits, no-op results, optional PNG/JPEG quality reduction, unchanged alpha samples, standalone file routing, JPEG late metadata, and release inventory/hash consistency.
- `npm run test:browser`: headless Chromium 153.0.8010.12 using Playwright 1.62.1. File selection, worker processing, download, output integrity, escaped filenames, uppercase extension, no-op, signature rejection, cancellation/reselection, 320px layout, no document uploads, offline installation/reload/new-file optimization, cache repair, failed installation, and two-window update protection passed. A persistent first-install deployment-transition regression also verifies that page and controller converge on the same complete release.
- Independent image oracle: Pillow raw pixels, dimensions and metadata comparisons; native jpegtran canonical output comparison to establish JPEG coefficient and metadata preservation. Includes transparent, palette, grayscale, interlaced PNG and baseline/progressive JPEG. Truncated JPEGs are preserved instead of silently repaired. Unsupported CMYK and animated PNG are retained.
- A realistic python-docx fixture includes visible PNG/JPEG images, a shared header image, footer, comment and tracked insertion. All unchanged package-part bytes compare exactly after optimization.
- LibreOffice rendered the original and optimized realistic fixtures to one-page PDFs. Poppler renderings at 1400px were pixel-identical. This verifies that renderer's result; it is separate from a Word UI check.
- Desktop and 320px screenshots were inspected. Normal controls and focus indicators are available; browser automation exercised keyboard focus and visible errors. Complete assistive-technology evaluation is not claimed.

Generated fixtures are synthetic and contain no personal records. Screenshots and downloaded outputs are under ignored `tests/output/`. Fixtures have deterministic image profile dates and ZIP timestamps.

## Measured examples

| Synthetic fixture | Input | Result | Saving | Node processing time |
| --- | --- | --- | --- | --- |
| Mixed media package | 7,587 B | 6,779 B | 808 B / 10.6% | 197 ms |
| Realistic Word package | 42,810 B | 42,129 B | 681 B / 1.6% | 121 ms |

These small fixtures are correctness checks, not typical-document benchmarks. ZIP already compresses parts of the original PNG data. Savings depend on the source images and the surrounding archive.

The measured Node process peak RSS reached approximately 114 MiB across those two operations. This predates optional JPEG recompression and is a whole-process high-water mark for small inputs, not a browser/mobile memory measurement or a maximum-size document guarantee. The current complete cached app is approximately 1.33 MiB before transport compression, including the exact-pixel PNG decoder, PNG color reducer and expanded JPEG codec. PNG optimization is single-threaded; JPEG WebAssembly memory growth is capped at 512 MiB.

History restoration checks dispatch persisted `pagehide`/`pageshow` events in ready, processing and result states. An actual BFCache restore was unavailable in headless Chromium, so physical browser-history verification remains outstanding. The release mismatch protocol also has a focused unit regression proving that new work is blocked while reload waits for an active operation to become idle.

The independent final review found two important lifecycle issues. Both were fixed with failing regressions followed by passing full suites; no minor findings were deferred.

## Remaining verification

- Microsoft Word opening and visual inspection were not completed. Both Word and LibreOffice were present, but a stable Word automation session was unavailable; no user's existing documents were modified.
- Safari 17, Firefox 121, Edge 120, physical devices and an actual installed-PWA window were not verified. Browser floors are targets, not claims established by the Chromium tests. Service-worker and manifest behavior was tested in normal Chromium contexts.
- Large files near the published memory/size limits need device-specific benchmarking. Mobile large-document processing remains outside verified scope.
- Manual screen-reader evaluation and physical touch verification remain outstanding. Automated 200% text layout and keyboard traversal are covered by the browser suite.
- Comparison of complete representative documents and the user's LightImage settings remains outstanding; supplied PNG and JPEG pairs are measured below. Strict lossless savings are not promised to match LightImage.

## Reproducing checks

Follow the dependencies and commands in `README.md`. The browser test creates its own loopback server and isolated browser contexts. For the render comparison, convert `tests/fixtures/realistic.docx` and `tests/output/realistic.docx` separately with LibreOffice, then render both at the same scale with Poppler and compare the PNG pixels. Original and output document parts can also be independently compared with Python's `zipfile`.

## PNG compression correction

The app's report showed ten PNGs skipped solely because OxiPNG changed their internal representation. A synthetic diagram reproduced the defect: 11,976 B became 5,651 B (52.8% smaller), with identical dimensions and all RGBA pixels, but the original guard rejected it. This is a correctness improvement to lossless optimization, without introducing perceptual/lossy compression.

Regression tests now accept exact-pixel palette and grayscale changes and reject a codec result with a changed pixel. Both 8-bit and 16-bit images are checked; representation-dependent metadata receives conservative fallback. The independent oracle passes 12 image fixtures, and the complete DOCX/browser/offline suites pass with the new decoder included in the release cache. The fixture generator's comment timestamp normalization was corrected for python-docx 1.2.0; the realistic fixture now regenerates successfully.

The supplied original/LightImage PNG pair was compared locally after this correction. Both are 597 × 1067 pixels. The original is 499,645 B with 70,962 distinct RGBA colors; LightImage's result is 59,138 B with a 30-color indexed palette (88.164% smaller). Alpha is identical, but 58.585% of pixels have changed RGB values, with mean absolute RGB channel difference 2.938/255. This establishes pixel-changing color reduction for this example; it does not establish the tool's settings or behavior on other inputs.

The corrected strict lossless engine produces 339,511 B from that original (32.050% smaller). An independent Pillow RGBA comparison confirms every decoded pixel and the dimensions are identical. The supplied files were not modified or copied into repository fixtures. Matching LightImage's reduction required the separately authorized perceptual mode described below.

Focused review also found that truecolor PNG suggested palettes must be treated as metadata. A failing regression demonstrated their removal was previously accepted. Optimization now retains the original when a representation change would discard such a palette, and final verification independently rejects palette removal. All 53 unit tests pass.

## Optional color mode

The user subsequently approved optional perceptual PNG color reduction, preserving dimensions and providing a before/after preview. Exact lossless remains the default. The supplied original PNG was measured locally with all four palette limits:

| Maximum colors | Output bytes | Saving | Mean absolute RGB channel difference / 255 |
| --- | ---: | ---: | ---: |
| 32 | 43,996 | 91.2% | 2.696 |
| 64 | 56,632 | 88.7% | 1.682 |
| 128 (default) | 73,031 | 85.4% | 1.114 |
| 256 | 96,135 | 80.8% | 0.785 |

Independent Pillow comparisons confirm dimensions of 597 × 1067 and unchanged alpha samples for all four results. Original ancillary metadata chunks compare byte-for-byte; the interlace method and palette/transparency encoding may change. These measurements establish savings on this one image and do not guarantee invisible differences or whole-document reduction. No supplied user images are included in repository fixtures.

The new synthetic textured fixture proves smaller color-reduced output than exact lossless, unchanged input bytes, a valid bounded palette, dimensions and metadata preservation, and protection of other DOCX parts. A negative test proves a changed alpha value is rejected even in color mode. The existing independent lossless oracle still passes all 12 image fixtures.

Chromium browser checks cover both modes, palette selection, invalidation of an old download after settings changes, lazy preview image loading, closing, actual-pixel zoom, synchronized scrolling, and a 320px preview layout. Full offline reload then color reduction and preview succeed with cached dependencies. Desktop and narrow screenshots were inspected. Older-browser, installed-app, physical-device and maximum-size memory gaps above remain applicable.

## JPEG quality reduction and standalone images

The supplied original JPEG is 2,036,321 bytes at 2160 × 3840. LightImage produces 790,030 bytes (61.2% smaller), changes quantization tables, retains 4:2:0 sampling and has a mean absolute RGB difference of 1.362/255 from the decoded original. The new optional JPEG quality 70 produces 808,996 bytes (60.3% smaller), retains dimensions and sampling, and has mean absolute RGB difference 1.502/255. Pillow independently confirms the app's original APP/COM metadata is identical. LightImage's metadata differs, including an added sRGB profile. These are raw RGB comparisons with the same decoder, not guarantees of identical appearance or a recovery of LightImage's quality setting.

The quality regressions exercise baseline, progressive and grayscale JPEGs, changing quality only in optional mode, invalid settings/truncated input fallback, metadata preservation and protection of other DOCX parts. Pillow independently decodes all three quality outputs and confirms dimensions, sampling, color mode and APP/COM metadata. The default lossless oracle continues to pass all 12 fixtures.

Focused review reproduced loss of a valid COM marker after baseline scan data. The added test failed before the fix and passes after full-scan metadata inspection/restoration. A clean candidate without that marker is now rejected. Native jpegtran independently parses the retained late comment from the corrected output.

Browser checks exercise standalone JPEG/PNG selection, the appropriate per-format controls, correct download name/type, preview, EXIF-rotated JPEG display, invalid PNG rejection, settings invalidation and standalone lossless JPEG preview. After a completely offline reload, both standalone formats optimize and preview successfully, alongside the existing DOCX flow. The JPEG preview screenshot was inspected. Deployment-transition tests now change only the synthetic release identifier and work across human-readable release dates. No private user image was added to repository fixtures, and no files were uploaded or originals modified.
