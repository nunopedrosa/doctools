# Implementation decisions and final review

The approved PWA was implemented natively in this chat on `codex/local-docx-pwa`. The original shell tools remain available. No production deployment or remote push was performed.

## Decisions made during execution

- Used the existing clean checkout on a dedicated feature branch to keep the user's working location stable. Cost: implementation files are visible in that checkout, without a separate worktree.
- Built a small coefficient-preserving libjpeg-turbo wrapper with Emscripten 4.0.18 because a verifiable prebuilt browser wrapper was unavailable. Cost: maintaining the native wrapper and reproducible compiler instructions.
- The initial implementation retained all PNG representation changes. User feedback exposed that this rejected useful lossless savings. The corrected implementation compares exact decoded pixels and allows equivalent representations while preserving metadata. Cost: an additional decoder, CPU and memory; no pixel-quality concession. Representation-dependent metadata still receives conservative fallback.
- Include a digest of every runtime asset, including the service worker, in the release identity. Cost: longer identifiers and a new cache identity for each runtime change; this protects the active cache during failed updates.
- On 2026-10-15 the user approved an optional PNG color-reduction mode with previews after direct comparison established that LightImage changes colors while retaining dimensions. Exact lossless remains the default. The new mode uses UPNG.js with 32/64/128/256-color settings, keeps alpha samples and original metadata, and uses the existing lossless path for unsupported variants. Previews load one original/result pair, support fit and actual-pixel views, synchronize scrolling, and release object URLs when dismissed or invalidated. Cost: colors may change visibly; additional worker result retention and quantization memory. This supersedes the original specification's lossless-only scope without weakening that mode.
- The user then authorized optional JPEG quality reduction and standalone PNG/JPEG files alongside DOCX. JPEG quality 70 is the initial optional setting, measured against the supplied LightImage pair; exact lossless remains the default. Reused libjpeg-turbo with a separate pixel-changing function instead of browser canvas encoding. Cost: approximately 250 KiB of additional WASM payload and decoding/encoding work. Generic file routing stays in the worker, with shared MIME/extension checks and the same image engine for embedded and standalone media. Standalone images have a 50 MiB/25-megapixel ceiling, format-preserving downloads and previews in both modes when changed.

## Independent review and fixes

The independent reviewer found no critical issues and two important lifecycle issues. Both received regression coverage and were fixed in the final pass:

1. A first visit spanning deployment could leave page and controller releases inconsistent. A mismatch now blocks new work and reloads into the controlling release when the current operation becomes idle. A focused protocol test failed before the fix and passed afterward. The reviewer's real-browser reproduction then reported matching page/controller releases and Ready offline. Its scenario is retained as `tests/release-transition.mjs`.
2. Restoring a page from browser history could leave an enabled Optimize button after its worker was terminated. Leaving or restoring the page now clears document/result references, object URLs, worker, busy state and controls together. Browser regressions for ready, processing and result states failed before the fix and passed afterward. They simulate persisted lifecycle events; actual physical BFCache behavior remains unverified.

The reviewer reported no minor findings to defer. Full unit and browser suites were rerun after the fixes; see `VERIFICATION.md`.

The focused review of the optional color mode found no important or critical issues. It checked mode isolation, awaited verification, metadata fallback, alpha preservation, preview cleanup and stale-job filtering. It independently checked all four palette limits and identical JPEG output across modes.

The JPEG/standalone review found one important metadata edge case: markers after baseline entropy-coded scan data were omitted by recompression and missed by the header-only verifier. A failing regression reproduced removal of a late COM marker. The JPEG parser now walks all scans, the wrapper restores the original metadata tail before EOI, and final verification rejects lost metadata. The focused test and full suites pass; native jpegtran independently reads the retained late comment. No other important or critical findings were reported.

## Review scope decisions

- Alternate main-document locations remain outside this release's approved `word/document.xml` contract. Cost: uncommon otherwise valid OOXML packages may be rejected rather than optimized.
- Word, older-browser, installed-app, physical-device and maximum-size memory checks remain accurately documented gaps. Cost: those environments and extreme inputs are not established by the Chromium and small-fixture results.
- The reviewer examined wrappers, dependency configuration and provenance but did not independently reproduce the vendor compiler build. Cost: binary provenance relies on the recorded pinned build and behavioral/oracle checks, rather than a second byte-for-byte build.
