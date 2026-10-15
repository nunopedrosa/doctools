# Doctools verification

Verification date: 2026-10-15. This is a local development result; no live site has been deployed.

## Automated checks

- `npm test`: 45 passing tests covering codec preservation, DOCX round trips, unsafe/corrupt/unsupported archives, encrypted and signed input, entity declarations, UTF16 XML, Strict OOXML namespaces, relationship resolution, limits, no-op results, and release inventory/hash consistency.
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

The measured Node process peak RSS reached approximately 114 MiB across those two operations. This is a whole-process high-water mark for small inputs, not a browser/mobile memory measurement or a maximum-size document guarantee. The complete cached app is approximately 833 KiB before transport compression. PNG optimization is single-threaded; JPEG WebAssembly memory growth is capped at 512 MiB.

History restoration checks dispatch persisted `pagehide`/`pageshow` events in ready, processing and result states. An actual BFCache restore was unavailable in headless Chromium, so physical browser-history verification remains outstanding. The release mismatch protocol also has a focused unit regression proving that new work is blocked while reload waits for an active operation to become idle.

The independent final review found two important lifecycle issues. Both were fixed with failing regressions followed by passing full suites; no minor findings were deferred.

## Remaining verification

- Microsoft Word opening and visual inspection were not completed. Both Word and LibreOffice were present, but a stable Word automation session was unavailable; no user's existing documents were modified.
- Safari 17, Firefox 121, Edge 120, physical devices and an actual installed-PWA window were not verified. Browser floors are targets, not claims established by the Chromium tests. Service-worker and manifest behavior was tested in normal Chromium contexts.
- Large files near the published memory/size limits need device-specific benchmarking. Mobile large-document processing remains outside verified scope.
- Manual screen-reader evaluation and physical touch verification remain outstanding. Automated 200% text layout and keyboard traversal are covered by the browser suite.
- Comparison with the user's LightImage settings and representative real documents remains outstanding. Strict lossless savings are not promised to match LightImage.

## Reproducing checks

Follow the dependencies and commands in `README.md`. The browser test creates its own loopback server and isolated browser contexts. For the render comparison, convert `tests/fixtures/realistic.docx` and `tests/output/realistic.docx` separately with LibreOffice, then render both at the same scale with Poppler and compare the PNG pixels. Original and output document parts can also be independently compared with Python's `zipfile`.
