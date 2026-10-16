# Local DOCX image optimizer design

## Purpose and scope

Turn doctools into a standalone PWA that replaces the manual unpack, LightImage, and repack workflow. The user selects one DOCX, optimizes embedded PNG and JPEG images on their own device, reviews savings, and downloads a new DOCX. Preserve image resolution and quality, and preserve the rest of the document.

The first release supports one document at a time and strict lossless optimization only. Keep the existing shell tools available. Exclude PDF, PPTX, standalone image conversion, batch processing, cloud storage, accounts, telemetry, and native helper services.

Use the shared principles in `../../../../pwa/docs/PRINCIPLES.md` as architectural guidance, and explicitly adopt `../pwa/AGENTS.md` in this repository's future app instructions. Doctools remains a separate repository and application. Register it in the toolbox only after a deployed URL is established.

## User workflow

1. Select or drop a `.docx` file. Accept the extension case-insensitively, then validate its contents rather than trusting its name or MIME type.
2. Inspect the package in a background worker. Show filename, document size, embedded-image count, formats, and the strict lossless policy before processing.
3. Start optimization. Show progress by image, with an accessible Cancel button. Keep controls and keyboard interaction responsive.
4. Show original and resulting document sizes, bytes and percentage saved, and per-image outcomes: optimized, already efficient, unsupported, or preserved after an optimization failure.
5. Download `original-name-compressed.docx` through an ordinary browser download. Never overwrite the input. Provide Clear to release the document and result from memory.

If no smaller complete package can be produced, report that no reduction was possible and keep the original bytes. Do not describe an unchanged result as compressed. A document without embedded images is a valid no-op.

Use a focused, accessible interface with readable focus indicators, a labeled file input, status announcements, visible errors, and a narrow-screen layout. Display imported filenames as text; never insert imported content as HTML or render document XML.

## Architecture and local operation

Use a static HTML/CSS/JavaScript application with separately maintained modules for UI state, worker communication, DOCX package handling, and image optimization. Run archive processing and codecs in a dedicated Web Worker. Cancellation terminates the worker, discards partial output, and allows another selection.

Bundle and pin the ZIP library, codec wrappers, WebAssembly binaries, and their licenses in the published assets. Make no runtime requests to third-party CDNs. Prefer no application build step; a documented maintainer-only dependency preparation or codec build is acceptable when necessary to obtain verifiable lossless components. No server processes document data.

Serve from HTTPS or a stable localhost origin. Direct `file://` launch is outside the supported workflow. Provide a documented localhost preview command. Installation is optional; ordinary browser use provides the full processing workflow.

Cache the app shell, worker, libraries, and every required codec binary in a versioned service-worker cache scoped to doctools. Show Ready offline only after the complete required asset set has been cached and the page is controlled by the service worker. Verify offline reload and processing, rather than inferring readiness from connectivity alone. Cache application assets only, never selected DOCX files or generated downloads.

Keep updates waiting during an active job. Offer the new version when idle; activating it must not combine assets from different releases. Scope cache cleanup to doctools. Document that clearing browser site data removes offline assets and requires reloading the app from its host.

Keep documents and results in memory, with no IndexedDB document history or browser-storage backup system. Store at most non-sensitive preferences if needed. Revoke download object URLs and terminate workers when clearing or replacing a job.

## Browser support and initial limits

Target desktop Safari 17+, Chrome/Edge 120+, and Firefox 121+. These are proposed support floors, not verified compatibility claims. Support ordinary file selection and downloads without requiring File System Access APIs, SharedArrayBuffer, cross-origin isolation, or multithreaded WebAssembly. Installation UI varies by browser; give applicable manual instructions. Mobile layouts remain usable, but large-document processing on mobile is outside the first release's verified scope.

Start with conservative limits: 100 MiB input, 250 MiB total expanded package size, 5,000 entries, 50 MiB per expanded entry, and 25 megapixels per optimized image. Count all archive entries and expanded bytes, including unsupported formats. Enforce limits while reading as well as from declared sizes; do not allocate based solely on untrusted headers. Process one image at a time and release intermediate buffers. Actual peak memory exceeds file size; measure it and lower limits if target-browser tests require it. Report the specific limit reached and preserve the input.

## DOCX integrity

Validate ZIP structure, entry paths, duplicate entry names, CRCs, compression support, required package parts, content types, and document relationships. Reject traversal paths, encrypted input, malformed packages, and unsupported archive features with actionable errors. Never resolve linked images or external relationships over the network.

Reject digitally signed packages before optimization, explaining that modifying them would invalidate their signatures. Detect OOXML package signature parts and signature relationships. Detect encrypted Office containers separately where possible so password-protected files receive a useful explanation.

Only optimize existing image entries under `word/media/` whose extension and detected format agree. Include images used by headers and footers when stored there. Preserve unsupported, animated, or unrecognized image types unchanged and explain that outcome. Do not rename media, change extensions, create relationships, modify XML, or remove document properties or embedded objects.

Use a ZIP implementation that can copy unchanged compressed entries where supported. Preserve extracted bytes for every unchanged part even if ZIP container offsets or compression metadata change. Preserve entry names and relevant ZIP metadata; do not claim that the complete output archive is byte-identical to the input.

Before offering a download, reopen and validate the resulting archive, compare the complete entry-name set, and verify unchanged extracted entry bytes against the input. Verify changed entries satisfy their image invariants. Abort export on package-integrity failure. Reject a larger final package and use the original instead.

## Image preservation policy

Strict lossless means no resizing, color quantization, quality-factor reduction, chroma subsampling changes, or conversion to another image format. Preserve dimensions, transparency, orientation, color profiles, density, and other metadata affecting rendering or physical size. Preserve metadata by default, including metadata without a visible effect.

For PNG, use an OxiPNG-based binary-to-binary optimizer. Do not enable alpha-value changes, metadata stripping, or pixel-changing options. Verify original metadata and image invariants; if the chosen wrapper drops chunks, preserve them safely or leave the image unchanged. Avoid decoding through canvas or converting the input to ImageData as the optimization path. Preserve animated PNG unchanged in the first release.

For JPEG, use a browser-ready coefficient-preserving optimizer in the jpegtran/jpegoptim family, with all metadata copied and no geometric transforms. A quality-based JPEG encoder, including a generic MozJPEG encode API, is not an acceptable substitute. Preserve unsupported JPEG variants unchanged. Prove coefficient preservation and rendering metadata retention with fixtures before enabling the optimizer.

Accept an optimized image only when its byte length decreases and its invariants pass. On a per-image codec failure, retain that original image and show a warning; on archive corruption or package validation failure, fail the complete job. Do not promise a savings percentage. LightImage equivalence remains a benchmark question requiring representative inputs and the user's actual settings.

## Dependency selection

Evaluate zip.js for archive processing, a single-threaded OxiPNG WebAssembly build for PNG, and a coefficient-preserving JPEG WebAssembly component. Final versions and wrappers must pass the preservation tests before integration. Record source, version, license, binary sizes, total offline download size, build or acquisition steps, and applicable browser requirements in dependency documentation.

Do not silently ship PNG-only optimization as completion of this design. If no suitable JPEG wrapper exists, build a minimal reproducible wrapper around an established lossless optimizer or report the implementation blocker explicitly. Do not replace lossless optimization with visually similar re-encoding.

References:

- [Service worker API and secure hosting](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [zip.js](https://gildas-lormeau.github.io/zip.js/)
- [OxiPNG options and preservation caveats](https://github.com/oxipng/oxipng)
- [jpegtran lossless operations](https://github.com/mozilla/mozjpeg/blob/master/jpegtran.1)
- [jpegoptim](https://github.com/tjko/jpegoptim)

## Verification and release criteria

Use generated fixtures and locally available non-sensitive sample documents. Include PNG transparency, palette and grayscale images, color-profile and density metadata, JPEG EXIF orientation and ICC data, baseline/progressive JPEG, images shared by document parts, unsupported media, comments, tracked changes, headers/footers, and embedded objects. Include documents with no media and already optimized images.

Test pixel and metadata preservation for PNG and coefficient and metadata preservation for JPEG with independent tooling. Compare complete entry sets and hashes of all unchanged extracted DOCX entries. Confirm images retain dimensions, names, formats, and relationships. Open representative outputs in Word and inspect layout and images; record this as outstanding if Word verification is unavailable.

Exercise malformed ZIPs, duplicate and traversal names, encryption, signatures, CRC failures, unsupported compression, oversized entries, misleading size declarations, excessive entry counts, and high-pixel-count images. Assert rejection happens without partial downloads or damage to the input. Test per-image failure, complete-job failure, cancellation, reselection, and repeated processing.

Verify desktop and narrow layouts, keyboard flow, progress announcements, downloads, offline first use after preparation, offline reload, a new document optimized offline, missing-asset installation failure, service-worker updates, and zero document-data uploads. Check ordinary browser and installed-app contexts where available. Distinguish automated Chromium evidence from Safari, Firefox, installed-app, physical-device, and Word checks actually performed.

Keep the README aligned with operation, limits, dependency preparation, local serving, installation, offline readiness, privacy, and known limitations. Preserve the existing CLI instructions and correct their optimizer naming to LightImage. Do not deploy or add a public toolbox URL until an actual destination is established.

## Approval state

The in-chat proposal was approved on 2026-10-15. The written specification was subsequently approved, followed by the implementation plan and native execution. See `docs/VERIFICATION.md` for implementation evidence and remaining verification.
