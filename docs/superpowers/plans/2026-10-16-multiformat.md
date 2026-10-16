# Smaller multi-format implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user selected native execution. Steps use checkbox (`- [ ]`) syntax for tracking. Use one independent final branch review after implementation; this is not authorization for parallel implementation agents.

**Goal:** Add the approved document, comic, archive, map and artwork formats, with offline format descriptions and verified preservation.

**Architecture:** Keep the existing ZIP/image engines, introduce a capability-based format registry and retained worker sessions, then add validators for ZIP packages. Isolate libarchive and QPDF WebAssembly behind bounded adapters. PDF.js renders local previews without running document actions.

**Tech Stack:** Existing ES modules, zip.js 2.23.0, xmldom 0.9.12, PNG/JPEG codecs and Playwright; libarchive 3.8.10, XZ/liblzma 5.8.2, zlib 1.3.1, QPDF 12.4.2 and pdfjs-dist 5.6.205 (legacy build). Native builds use Emscripten 4.0.18. These are pinned candidate sources, not claims of completed browser qualification; the build/security/compatibility gates in the stage plans must pass before enabling them.

**Spec:** [Approved specification](../specs/2026-10-16-multiformat-design.md), approved after revision on 2026-10-16.

## Global Constraints

The following approved-spec requirements apply to every task in all four linked plans; stage plans incorporate this section by reference.

- “Files must stay on the device, originals must remain untouched, image dimensions must remain unchanged, and exact lossless optimization remains the default.”
- “Optional PNG colour reduction and JPEG quality reduction require explicit selection and before/after previews.”
- “Exclude macro-enabled Office files, including macro-bearing content disguised with a supported extension.”
- “Visio VSDM and other macro-enabled Visio variants are excluded as well.”
- “Do not unpack embedded documents or recurse into archives.”
- “For same-format output, retain the complete original if the rebuilt file does not shrink.”
- “For comic conversion, offer the converted CBZ even if larger, clearly report the size increase and never call it a saving.”
- “Optimize supported PNG layer files, merged image and thumbnail using exact lossless mode only.” This is the ORA-specific exception to optional quality reduction.
- “Retain current browser targets: Safari 17+, Chrome/Edge 120+, Firefox 121+. No required SharedArrayBuffer, server process or filesystem API. One file at a time.”
- “Retain 50 MiB standalone image input and 25 megapixels; use 100 MiB input for all packages/PDFs, 250 MiB expanded package data, 5,000 entries and 50 MiB per expanded archive entry.”
- “Preserve embedded images above 25 megapixels without decoding; PNG colour reduction stays limited to 4 megapixels.”
- “PDFs additionally have limits of 1,000 pages, 50,000 indirect objects and 250 MiB cumulatively decoded streams.”
- “Native module linear memory is bounded at 512 MiB, and every job has a 120-second timeout with termination-based cancellation.”
- “Ready offline means all advertised format engines are cached.”
- “Cache app assets only, never selected files or results.”
- “Deployment is a separate release operation after implementation and verification.”

No implemented family is removed to make the suite pass. Unavailable device/application verification is reported as a gap. Original CLI scripts and the live published release remain intact during development.

## Review Focus

1. A supported extension hiding macros/signatures or a known package renamed ZIP must not bypass validation. Stage A tasks A1/A2 and stage C repeat this against their validators.
2. CB7/CBR/CBT conversion can increase size or alter reader sorting; keep names/order, retain metadata files, and label conversion/increases accurately. Stage B tasks B2/B3 own the regressions.
3. Cancel/reselection during native execution, preview extraction or timeout must release resources and never surface stale results. Stage A task A1, stage B task B3 and stage D task D3 own these tests.
4. ORA composite/thumbnail correctness and EPUB font obfuscation are easy to mistake for ordinary image packages or encryption. Stage C tasks C1/C2 own exact-byte, pixel and rejection tests.
5. PDFs with shared images, forms, attachments, masks, nested resources or actions must preserve structure without executing imported content. Stage D tasks D1/D2/D3 own structural, rendering and request tests.

## Execution order and source setup

Run these plans sequentially. Together they implement the whole approved scope; the index is not a reduced feature list.

1. [Stage A — Registry, Office, Visio, KMZ and format help](2026-10-16-multiformat-a-zip.md).
2. [Stage B — Comics and ZIP/TAR/7z collections](2026-10-16-multiformat-b-archives.md).
3. [Stage C — OpenDocument, OpenRaster and EPUB](2026-10-16-multiformat-c-publications.md).
4. [Stage D — PDF and final integration](2026-10-16-multiformat-d-pdf.md).

- [ ] At execution start, read `AGENTS.md` from the PWA branch plus `../pwa/AGENTS.md`, and invoke using-git-worktrees. Inspect app attachments before creating/reusing an isolated worktree based on `codex/local-docx-pwa` (`7b803c8` at plan preparation). Do not switch or reset the user's `main` checkout.
- [ ] Bring the approved spec and these five plan files into that isolated branch by cherry-picking only the documented spec/plan commits after inspecting their diffs. Existing spec commits on main: `29c922d`, `94fdd4f`. Record the plan commit from `git log -- docs/superpowers/plans/2026-10-16-multiformat.md`; do not cherry-pick `d2ec49a`, which tracks dependencies/output files.
- [ ] Run baseline `npm ci --ignore-scripts`, `npm test`, `npm run test:browser` and `python3 scripts/image-oracle.py tests/fixtures tests/output/codecs`; record failures before modifications. Use the PWA's `.gitignore`; never commit node_modules, generated QA outputs or personal records.
- [ ] Execute stages A–D using failing behavior tests before product code and narrowly scoped commits after passing task checks. Keep enabled formats and help catalog synchronized at every stage; future entries may exist as disabled data, never as advertised support.
- [ ] Complete the final independent branch review, repair findings with regression tests and rerun affected checks. Preserve the native execution preference; the reviewer does not implement stages in parallel.
- [ ] Present the local result, exact formats and limitations, test evidence, dependency sizes and outstanding device checks. Do not deploy or change DNS/hosting under this expansion without a release request.

## Shared interfaces

Define these interfaces in Stage A. Later stages add adapters; they do not invent incompatible dispatch/result structures.

```js
// web/core/formats.js: lightweight static registry, safe to import on main thread.
enabledFormats(); // Format[] in user-facing group order
formatForName(name); // Format, or throws unsupported-extension error
// Format: {id, extension, label, family, kind, mime, outputExtension,
//          outputMime, outputLabel, modes, enabled}
// kind is 'image', 'document', 'comic', or 'archive'; PDF uses 'document'.
// modes is ['lossless','colors'] except ORA: ['lossless'].

// web/core/format-loader.js: worker-owned imports and signature/package validation.
openFile(bytes, name); // Promise<FileSession>
// FileSession:
// inspect() -> Promise<Summary>
// optimize(options, onProgress) -> Promise<Result>
// preview(previewId) -> Promise<{before,after,mime,perceptual}>
// Optional PDF-only pagePreview(pageNumber) -> Promise<{before,after,pageNumber}>;
// before/after are independent PDF byte copies, consumed by the local renderer.
// close() -> Promise<void>; idempotent; frees handles and retained buffers.
// Summary: {kind, extension, label, modes, qualityControls, images, entries?, pages?}
// qualityControls: supported control IDs, e.g. ['jpeg-quality'] for PDF, [] for ORA;
// Result: {bytes, changed, converted, downloadAvailable, extension, mime,
//          label, images, warnings}
// Image row: {path, previewId?, status, reason, perceptual, previewable,
//             before, after}; preview IDs map to validated resources in this session.
// changed means output differs from input; converted is independently explicit.

// Existing web/core/files.js exports remain usable for CLI/tests:
inspectFile(bytes, name); // opens, inspects, closes a session
optimizeFile(bytes, name, onProgress = () => {}, options = {});
// optimizeFile opens/optimizes/closes; result bytes survive session disposal.
// Existing inspectDocument/optimizeDocument wrappers remain DOCX-compatible.

// web/core/zip-session.js:
openZipSession(bytes, format, validator); // Promise<FileSession>
// validator(archive, format) -> Promise<{imagePaths, warnings?, modes?, imageConstraints?}>
// imageConstraints maps validated paths to required PNG representation properties.
// Uses existing archive.read/raw/entries/close and rewriteArchive.

// web/core/archive-native.js, Stage B:
openNativeArchive(bytes, container); // Promise<ArchiveHandle>
// container: 'rar' | '7z' | 'tar'; entries include name,size,directory,metadata.
// handle.read(name), rewrite(replacements, outputContainer), close().
// rewrite outputContainer: '7z' | 'tar' | 'zip'.
```

Do not expose worker sessions through the main-thread registry. Keep input-byte limits before allocation and signature/structural checks inside worker adapters. Use actual image signatures in addition to package declarations, preserving unsupported encodings with an explanation. Do not accept renamed known packages as generic collections.

## Dependency provenance and compatibility gate

Use the pinned upstream versions above. Before building, inspect their official security/release notices and record verified source digests/signature evidence, source URLs, toolchain build, compile flags and all transitive license notices in `scripts/native-sources.lock.json` and `docs/DEPENDENCIES.md`. A known applicable vulnerability blocks that build: select a fixed version, document the reason and rerun its task tests rather than knowingly shipping the candidate. This is ordinary dependency maintenance within scope.

Build from upstream source; do not adopt arbitrary prebuilt browser wrappers. The existing Emscripten toolchain location is `/tmp/emsdk-4.0.18`, but environment variables in reproducible scripts take precedence. Native crypto, filesystem extraction and network functionality are not required: encrypted formats are rejected. Enable only TAR/PAX, RAR/RAR5, 7z and required codecs in libarchive. LZMA is needed for common 7z input/output. QPDF needs zlib and its own supported crypto provider even though encrypted inputs are rejected; select its built-in native provider when cross-compiling. Do not link host libraries into WebAssembly.

Runtime source pins verified during planning: [libarchive 3.8.10](https://github.com/libarchive/libarchive/releases/tag/v3.8.10), [XZ 5.8.2](https://github.com/tukaani-project/xz/releases/tag/v5.8.2), [zlib 1.3.1](https://github.com/madler/zlib/releases/tag/v1.3.1), [QPDF 12.4.2](https://github.com/qpdf/qpdf/releases/tag/v12.4.2), [PDF.js 5.6.205](https://github.com/mozilla/pdf.js/releases/tag/v5.6.205). These links verify versions exist, not absence of vulnerabilities. Never enable PDF scripting; see [Mozilla's scripting advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j).

## Completion evidence

The final report must list all 30 enabled extensions: DOCX, DOTX, PPTX, PPSX, POTX, XLSX, XLTX, VSDX, KMZ, CBZ, CBR, CB7, CBT, ZIP, TAR, 7z, ODT, ODS, ODP, ODG, OTT, OTS, OTP, OTG, ORA, EPUB, PDF, PNG, JPG, JPEG. Every one has an accessible help dialog entry and a positive routing fixture. Native variants and PDF unsupported image cases also have explicit negative/no-op tests. Count automated tests from real output; do not reuse the old 68-test count for the new release.

Save synthetic screenshots, downloads and oracle reports under ignored `tests/output/`. Update `README.md`, `AGENTS.md`, `docs/DEPENDENCIES.md`, `docs/VERIFICATION.md`, `docs/IMPLEMENTATION-NOTES.md`, `docs/vendor-manifest.json`, runtime inventory and `.webmanifest` copy coherently. Deployment docs must distinguish the currently published older release from the newly tested local one.
