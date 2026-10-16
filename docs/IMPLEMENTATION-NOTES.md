# Implementation decisions and final review

The approved PWA was implemented natively in this chat on `codex/local-docx-pwa`. The original shell tools remain available. Initial implementation did not deploy or push remotely. The user subsequently authorized publication to `smaller.basecentral.link`; see [the deployment record](DEPLOYMENT.md). No Git remote push was performed.

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

- Historical DOCX-only review excluded alternate main-document locations. The approved multi-format expansion supersedes that restriction and validates main parts selected by root relationships.
- Word, older-browser, installed-app, physical-device and maximum-size memory checks remain accurately documented gaps. Cost: those environments and extreme inputs are not established by the Chromium and small-fixture results.
- The reviewer examined wrappers, dependency configuration and provenance but did not independently reproduce the vendor compiler build. Cost: binary provenance relies on the recorded pinned build and behavioral/oracle checks, rather than a second byte-for-byte build.

## Multi-format development: ZIP stage

The format registry is lightweight and worker sessions own retained input/result resources. Compatibility exports keep the CLI/test-facing DOCX/image functions. The worker now uses opaque preview IDs and each request has a 120-second termination deadline. ZIP optimization verifies ordered entry sets and all protected bytes, retains compressed unchanged entries, and exposes changed lossless images for preview as well.

OPC validation is shared across Office and Visio; document types, root namespaces and the main relationship are checked per extension. VBA, macro and signature declarations are rejected. KMZ validates KML, leaves map/model bytes and ZIP ordering intact, and never follows external resources. The app's local format help explains each enabled extension, supports native/fallback modal behavior, restores keyboard focus and does not reset jobs or results.

## Completed multi-format development

All 30 approved extensions route through worker-owned sessions. Office/Visio/KMZ, ODF, EPUB and ORA share ordered ZIP preservation with format validators. Generic ZIP/comic packages cannot disguise known typed packages. Native libarchive reads RAR/7z/TAR in memory; comics convert to CBZ while image collections keep ZIP/TAR/7z. Conversion is explicit and available even without savings. ORA enforces lossless mode and its mandatory PNG encodings after codec verification.

PDF uses QPDF for bounded parsing, stream inspection and writing, existing JPEG codecs for eligible image XObjects, and a full semantic graph comparison using QPDF's explicit object renumbering map. It preserves references/aliasing, protected scalar/stream values, metadata, forms, annotations, text, attachments, tags and unsupported image encodings. Page comparison is separate local PDF.js core rendering, with script/eval/annotation execution disabled and no remote resources. No PDF pages are rasterized into the saved document.

The independent whole-branch reviewer reproduced three issues: late ZIP output limiting, a mixed Office/KML bypass through KMZ, and rejected package-root Office relationship parts. Regression tests failed before fixes; the bounded output sink, family assertion and root-folder relationship handling now pass the reviewer's targeted reruns. All 79 independently run focused tests passed; no unresolved concrete findings remained. The reviewer did not establish native application, minimum-browser, installed-app or near-limit memory compatibility; separate application checks and remaining gaps are in VERIFICATION.md.

The user subsequently authorized updating the live site. The full multiformat release was staged from the clean committed runtime, verified by per-file SHA-256, atomically activated, and checked with all 30 formats offline on the public HTTPS origin. Hosting configuration, DNS, certificates, Agenda and Cloudflare rules were unchanged. The previous release remains available for rollback. DEPLOYMENT.md contains the source/archive identities and hosted evidence.
