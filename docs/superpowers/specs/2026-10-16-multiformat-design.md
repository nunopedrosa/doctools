# Smaller multi-format expansion

## Intent and scope

The user approved expanding the deployed local-first image/document optimizer to Office, KMZ, comics and image archives, OpenDocument, EPUB and PDF. Files must stay on the device, originals must remain untouched, image dimensions must remain unchanged, and exact lossless optimization remains the default. Optional PNG colour reduction and JPEG quality reduction require explicit selection and before/after previews. Do not promise particular savings.

Include these families in this order:

| Family | Input | Output |
| --- | --- | --- |
| Office | Existing DOCX, plus PPTX, PPSX, POTX, XLSX, XLTX, DOTX | Same extension and format |
| Google Earth | KMZ | KMZ |
| Comics | CBZ, CBR, CB7, CBT | CBZ; label non-CBZ inputs as conversions |
| Image collections | ZIP, TAR, 7z | Same archive format |
| OpenDocument | ODT, ODS, ODP, ODG; OTT, OTS, OTP, OTG | Same extension and format |
| Ebooks | DRM-free EPUB 2 and 3 | EPUB |
| Documents | PDF | PDF |

Exclude macro-enabled Office files, including macro-bearing content disguised with a supported extension. Defer Visio VSDX and OpenRaster ORA. Exclude legacy binary Office, CBA/ACE, password-protected/encrypted archives, multipart archives, self-extracting archives and nested archive processing. TAR means ordinary TAR/PAX, not compressed tar.gz/tar.xz variants in this scope. Do not unpack embedded documents or recurse into archives.

## Source and implementation boundaries

At inspection the checkout is clean on `main` at `d2ec49a`; it contains older CLI tools. The complete deployed PWA is on `codex/local-docx-pwa` at `7b803c8`, including `web/`, tests and deployment documentation. Implementation must start from the PWA branch in an isolated checkout, preserving the user's current main checkout and CLI scripts. This specification is preparatory documentation, not a claim that formats are implemented.

Relevant existing modules on that branch:

- `web/core/archive.js`: strict ZIP reading, bounded extraction and raw pass-through rewriting.
- `web/core/package.js`: DOCX-only content-type and relationship validation.
- `web/core/document.js`: image optimization and complete package verification.
- `web/core/files.js` and `file-types.js`: dispatch and input limits.
- `web/worker.js`: input/result lifecycle and ZIP-specific preview extraction.

## Approach decision

1. Recommended: retain zip.js for ZIP packages, add format validators, and add a separately loaded libarchive WebAssembly adapter for non-ZIP archives. Add a distinct PDF adapter. This preserves the proven DOCX path and isolates expensive new dependencies.
2. Replacing all archive handling with libarchive would unify APIs but discard the existing raw ZIP pass-through behavior and increase the regression surface.
3. Browser canvas conversion or server-side conversion would simplify some processing but fails the preservation or local/offline requirements and is excluded.

The implementation plan must pin audited dependency sources, versions, licenses and reproducible builds before installing runtime dependencies. Evaluate libarchive for TAR/PAX, 7z and RAR/RAR5 import and TAR/7z writing. Use QPDF compiled to WebAssembly for PDF object inspection, controlled stream replacement and serialization; use a pinned PDF.js renderer for local PDF preview and independent rendering checks. Retain native image codecs. Do not substitute a copyleft PDF engine or a remote conversion service silently if the selected engine cannot satisfy the tests.

## Shared processing contract

Introduce a format registry with explicit extension, MIME, signature/container checks, validator, output naming and preview adapter. Extension alone never establishes the format. Preserve the public inspect/optimize flow and worker job IDs; preview extraction must dispatch through the same selected adapter instead of assuming every document is a ZIP.

Each adapter provides inspection, optimization, output validation and extraction of an identified preview image. Report input format, output format, conversion status, before/after sizes, image statuses and reasons for skipped media. Use opaque preview IDs rather than trusting arbitrary user-supplied paths or object numbers.

Only supported PNG/JPEG image payloads are optimized. Other entries remain intact. Keep filenames, case, directories, entry order, file contents and representable archive metadata. Never resolve external links, execute scripts/macros, render imported HTML, or follow archive symlinks. Previews use isolated decoded images or the PDF renderer with scripting and external resource loading disabled.

For ZIP packages, retain existing compressed entry bytes for unchanged entries where possible. Verify every non-image entry's decoded bytes against the original and verify the full entry set and order after writing. ZIP comments and entry metadata remain preserved. Accept individual image replacements only when smaller and verified by existing image guards.

For TAR/7z, verify full names, order, regular-file bytes, directories and supported timestamps/modes after rewriting. Reject symlinks, hard links, special files and metadata features the writer cannot safely preserve; never silently drop them. Report archive-container metadata differences inherent to comic format conversion. Preserve ComicInfo.xml and all other ordinary files byte-for-byte, including unsupported page images. Keep entry ordering and names; do not rename pages or impose a new sort order. Reader-specific page ordering may differ after conversion and must be disclosed as a conversion limitation.

For same-format output, retain the complete original if the rebuilt file does not shrink. For comic conversion, offer the converted CBZ even if larger, clearly report the size increase and never call it a saving. Original and output extensions and MIME types must be correct throughout downloads and previews.

## Format validation

### Office

Split common Open Packaging Conventions validation from format-specific rules. Resolve the main part through the root officeDocument relationship and validate expected content type, root namespace and supported extension. Check content types and internal relationship targets across the package, with Strict and Transitional namespaces supported where applicable. Detect package signatures, macro content types, VBA parts/relationships and active-content types incompatible with this scope before processing. Reject signed and macro-bearing packages rather than stripping those parts.

Discover eligible PNG/JPEG image parts through package content types and image relationships, not a Word-only directory assumption. Preserve text, formulas, cached values, charts, slide masters, notes, animation XML, comments, tracked changes and embedded objects byte-for-byte. Never calculate formulas or update external links.

### KMZ

Require a valid KML document in the archive. Preserve all entry ordering, especially the first KML file used by Google Earth, and all KML bytes unchanged. Optimize only bundled PNG/JPEG entries; do not fetch linked images. Do not parse and reserialize coordinates, paths or map content. Preserve bundled models and unsupported resources. Test local relative-image references, overlays, multiple KML files and mixed-case names.

### Comics and collections

Validate actual ZIP/RAR/7z/TAR signatures and reject extension mismatches. CBR and CB7 import through the non-ZIP adapter; CBT uses TAR. Collections may contain non-image regular files, which must remain unchanged; inspect unsupported image entries as skipped. Archives with no supported images produce a clear no-op. Do not treat an Office/EPUB/KMZ package renamed to ZIP as an unvalidated bypass: recognize known package signatures and require its format-specific validator or reject the mismatch.

### OpenDocument

Validate `mimetype`, `META-INF/manifest.xml`, the requested document/template type and expected content root. Preserve the required first, uncompressed mimetype entry. Discover images through manifest media types. Reject encrypted packages and digital signatures. Keep all XML, formulas, embedded objects and other non-image bytes unchanged. Do not convert flat XML OpenDocument variants.

### EPUB

Require the correct first, uncompressed `mimetype`, `META-INF/container.xml` and valid referenced package documents. Validate manifests, spine and local image targets. Preserve all XHTML, CSS, navigation, fonts, identifiers and metadata byte-for-byte, including multi-rendition packages. Reject signatures and DRM/encrypted content. Permit standard font obfuscation only when it affects fonts, keep those bytes and encryption descriptors unchanged, and reject unknown encryption algorithms. The presence of encryption.xml alone does not establish DRM. Do not execute publication scripts or fetch remote resources.

## PDF adapter

PDF needs a real object parser and writer, not ZIP processing or regex replacement. Keep text selectable and preserve pages, boxes, rotation, fonts, bookmarks, links, annotations, form fields, attachments, accessibility tags and metadata semantically. PDF serialization changes object offsets and may change object numbers; byte-identical non-image serialization is not promised. Preserve numeric precision and do not add producer/date changes unnecessarily. Reject encrypted, digitally signed and malformed PDFs requiring automatic repair. Do not execute actions or scripts.

The first PDF implementation optimizes eligible embedded JPEG image XObjects and performs verified lossless structural compression. Eligible images are 8-bit DeviceRGB or DeviceGray with a single DCTDecode filter, ordinary decode semantics and no masks, soft masks or alternate-image relationships. Preserve dimensions and image dictionaries except encoding bookkeeping required for the replacement. Native JPEG guards still apply. Shared images are replaced once by object identity, including images reached through nested form resources.

Preserve unsupported image encodings and complex colour/mask cases unchanged, including inline images, JPX, JBIG2, CCITT and Flate/predictor images. Show these limitations and skipped counts. Optional quality reduction applies only to eligible images. Do not rasterize complete pages, remove fonts, drop attachments or downsample images to obtain savings. A PDF with no safe changes remains a supported no-op; it is not reported as compressed.

Use QPDF's object/stream facilities to preserve full stream dictionaries and unrelated objects. Verify object semantics and non-image decoded streams before accepting an output. Compare lossless page renders with an independent renderer in tests; perceptual-mode fixtures must establish unchanged text, geometry and document features while isolating differences to selected image objects. Preview changed image XObjects locally; provide page previews with PDF.js without treating them as proof of preserved PDF structure. If preservation verification fails, retain the original and report failure rather than provide a damaged download.

## Limits, lifecycle and offline assets

Retain current browser targets: Safari 17+, Chrome/Edge 120+, Firefox 121+. No required SharedArrayBuffer, server process or filesystem API. One file at a time. Retain 50 MiB standalone image input and 25 megapixels; use 100 MiB input for all packages/PDFs, 250 MiB expanded package data, 5,000 entries and 50 MiB per expanded archive entry. Preserve embedded images above 25 megapixels without decoding; PNG colour reduction stays limited to 4 megapixels.

PDFs additionally have limits of 1,000 pages, 50,000 indirect objects and 250 MiB cumulatively decoded streams. Count actual output while decoding, not just declared sizes. Native module linear memory is bounded at 512 MiB, and every job has a 120-second timeout with termination-based cancellation. These limits are caps, not a claim that mobile devices can handle every file at those caps.

Heavy archive and PDF engines are lazy-initialized in workers. Vendor all runtime dependencies locally and include them in release hashes and verified offline inventory; no runtime CDNs. Ready offline means all advertised format engines are cached. Show preparation size/progress; never claim ready after a partial cache. Document total payload changes. Free native handles, buffers and Blob URLs on cancellation, reselection, completion and worker termination. Cache app assets only, never selected files or results.

## Delivery and verification

Deliver independently tested stages in the agreed order, without silently dropping later stages. First generalize ZIP packages and add Office/KMZ; next add comics and archive adapters; then OpenDocument/EPUB; then PDF. Each stage updates dispatch, worker previews, accessible UI copy, limits, MIME/download names, dependency notices, release manifest, service worker and documentation together. A failed later-stage feasibility check is an explicit blocker, not completion of the requested full scope.

Generate synthetic fixtures for every advertised extension and container variant. Independently compare all protected entry contents, metadata, ordering, image invariants and valid output format. Include corrupt checksums, archive bombs, misleading lengths, duplicate/traversal names, XML entities, encryption, signatures, macros disguised as non-macro Office, unsupported codecs, nested archives, shared images, Unicode filenames, metadata, no-op, larger conversions and cancellation/timeouts. RAR fixtures must cover both RAR4 and RAR5 with documented provenance; no personal comics or books are test uploads.

Use native archive tools, format validators and representative application opening/rendering where available: Office/LibreOffice, Google Earth, comic readers, EPUBCheck/readers and QPDF plus an independent PDF renderer. Record unavailable application checks accurately. Existing unit/browser/image-oracle suites remain required. Extend browser tests to inspect and optimize every family offline after a fresh offline reload, preview changed images, download correct outputs, cancel/reselect, update across versions and prove zero uploads or imported-file cache entries. Distinguish modern Chromium evidence from actual target-browser/device verification.

Deployment is a separate release operation after implementation and verification. Keep the currently published release intact throughout development. Preserve existing documented rollback and atomic activation procedures; do not change Agenda or global hosting settings.

## Primary references

- [Microsoft Office formats](https://learn.microsoft.com/office/compatibility/office-file-format-reference)
- [Google KMZ packaging](https://developers.google.com/kml/documentation/kmzarchives)
- [OpenDocument packages](https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part2-packages.html)
- [EPUB specification](https://www.w3.org/TR/epub-33/)
- [libarchive formats and sources](https://github.com/libarchive/libarchive)
- [QPDF JSON stream updates](https://qpdf.readthedocs.io/en/stable/json.html)
- [QPDF source and Apache-2.0 license](https://github.com/qpdf/qpdf)

## Review status

Feature scope was approved on 2026-10-16. This written design requires review before the implementation plan and product code. Preserve the user's earlier preference for native execution when preparing the plan.
