# Stage D: PDF preservation and final integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Native execution after A–C; complete D1–D3 sequentially, then request one independent whole-branch review.

**Goal:** Add content-preserving PDF optimization and previews, then verify the complete 30-extension local/offline release.

**Architecture:** QPDF provides object parsing/writing through a bounded C++/WebAssembly bridge. Replace only eligible JPEG XObject streams through the existing JPEG engine and verify the complete logical document before accepting output. PDF.js provides local page previews independently of optimization.

**Tech Stack:** QPDF 12.4.2, zlib 1.3.1, Emscripten 4.0.18, pdfjs-dist 5.6.205 legacy build, native JPEG engine, Python/Poppler/QPDF development oracles.

**Spec:** [Approved specification](../specs/2026-10-16-multiformat-design.md).

## Global Constraints

All [master-plan global constraints and interfaces](2026-10-16-multiformat.md) apply verbatim. “PDFs additionally have limits of 1,000 pages, 50,000 indirect objects and 250 MiB cumulatively decoded streams.” “Do not rasterize complete pages, remove fonts, drop attachments or downsample images to obtain savings.” “Cache app assets only, never selected files or results.”

## Review Focus

- Shared image XObjects nested in Form XObjects must be discovered once without looping on cyclic resources (D1/D2).
- An encrypted or signed PDF must be rejected even if its password is empty or its signature field is not on the visible page (D1).
- Masks, ICC/Indexed colour, Decode arrays, inline images and unusual JPEGs must be kept unchanged and reported (D1/D2).
- Structure verification must cover links/forms/attachments/tags/metadata and cycles after object renumbering; rendering alone is insufficient (D2).
- PDF actions/scripts/fonts/remote references must not execute or cause external fetches; preview rendering must obey limits and cancellation (D3).

### Task D1: bounded QPDF bridge and structural inspection

**Files:** Create `scripts/build-pdf.sh`, `scripts/codec/pdf.cpp`, `web/core/pdf-engine.js`, `web/vendor/pdf.js`, `web/vendor/pdf.wasm`, `web/vendor/licenses/qpdf.txt`, `tests/pdf-engine.test.mjs`, `scripts/fixtures-pdf.py`, `tests/fixtures/multiformat/pdf/PROVENANCE.md`. Modify `scripts/native-sources.lock.json`, `scripts/vendor.mjs`, `docs/DEPENDENCIES.md`, `docs/vendor-manifest.json`, `web/core/limits.js`.

**Interfaces:** `pdf-engine.js` exports `openPdf(bytes,limits)` returning `{inspect(), readImage(objectId), snapshot(), write(replacements), close()}`. `inspect()` returns `{pages,objects,images,warnings}`; each image is `{objectId,width,height,eligible,reason}`. `snapshot()` returns a bounded logical graph of objects, dictionaries, exact scalar values, references and stream hashes; it includes unreferenced content objects. `write(replacements)` takes a Map from validated object IDs to Uint8Array JPEG bytes, preserves complete dictionaries, performs only lossless structural stream compression, and returns output bytes. C++ exported `ds_pdf_*` functions implement these operations, use opaque handles and copy result buffers to JS; never expose live heap views or catch errors as successful empty documents.

- [ ] Add `scripts/fixtures-pdf.py` using a deterministic tiny PDF object writer: write supplied ASCII dictionaries/streams, record actual object offsets, emit a valid xref/trailer and exact stream lengths. Embed existing synthetic JPEG bytes with DCTDecode and uncompressed/flated non-image content. Generate RGB/gray image, shared-image, nested-form, no-image, form, link, attachment, bookmark, tagged-content, Unicode metadata, rotated/cropped page, invalid-xref, encrypted-empty-password, signed-field, cyclic-resource and large-declared-stream fixtures. Use installed native QPDF only to generate encryption/object-stream variants from synthetic originals; verify all intended-valid originals with `qpdf --check`.

```js
test('inspect shared and masked PDF resources conservatively', async () => {
  const h = await openPdf(await fixture('multiformat/pdf/shared-images.pdf'));
  try {
    const info = await h.inspect();
    assert.equal(info.pages, 2);
    assert.equal(info.images.filter(i => i.eligible).length, 1);
    assert.equal(new Set(info.images.map(i => i.objectId)).size, info.images.length);
  } finally { await h.close(); await h.close(); }
});
for (const name of ['encrypted-empty-password','signed-field','invalid-xref']) {
  test(`reject PDF ${name}`, async () => {
    await assert.rejects(() => openPdfFixture(name));
  });
}
```

Define `openPdfFixture(name)` locally as `openPdf(await fixture('multiformat/pdf/'+name+'.pdf'))`. Add explicit unsupported eligibility fixtures for SMask/Mask, ImageMask, Indexed/ICCBased/CMYK colour, Decode transforms, JPX/JBIG2/CCITT/Flate, multi-filter streams, unusual bit depths and malformed DCT dimensions. Unsupported valid images are not errors for the complete document. Count all indirectly referenced and unreferenced objects, not just pages. Test inflated streams against an injected small decoded limit, page/object ceilings and output allocation failure.

- [ ] Run `python3 scripts/fixtures-pdf.py`, then `node --test tests/pdf-engine.test.mjs`; expect missing bridge/import failures before native implementation.
- [ ] Verify QPDF 12.4.2 source/signature, applicable security notes and source digest; update B's source lock before building. Cross-compile static zlib and QPDF with a supported built-in crypto provider, CLI/tests disabled for runtime and no host libraries. Use Emscripten ES module/single-thread settings, memory growth with 512 MiB maximum and memory-only APIs. Keep build provenance and transitive licenses.

```cpp
// Bridge-owned pattern, not an upstream QPDF API declaration:
// ds_pdf_open copies at most 100 MiB, disables recovery, then processes memory.
// Reject isEncrypted(), warnings requiring repair, or any signature dictionary.
// Traverse each resource graph with a visited set and enforce object/page caps.
// A bounded Pipeline sink counts each decoded write before retaining the chunk.
```

Use QPDF's streaming `pipeStreamData`/Pipeline facilities for decoded-stream metering; do not call an unbounded `getStreamData()` and only check length afterward. The bridge's output sink rejects allocation beyond documented bounds before copying. Reject parser recovery/warnings that indicate repair; do not “fix” malformed originals. Signature checks scan all fields/objects for signature dictionaries and ByteRange/DocMDP, not only AcroForm visible widgets. Preserve unsupported image streams raw and record skip reasons. Protect cyclic page/resource graphs with visited sets.

- [ ] Run native focused tests in Node and a real browser worker, repeat across raw/object-stream/xref-stream valid fixtures, compare native QPDF inspection, and record output module bytes/hashes. Test early limit errors and close on every path. Regenerate vendor/release inventories and run `npm test`.
- [ ] Commit: `git commit -m "Add bounded QPDF inspection and memory-only PDF writing"`.

### Task D2: JPEG replacement, PDF sessions and semantic verification

**Files:** Create `web/core/pdf.js`, `web/core/pdf-verify.js`, `tests/pdf.test.mjs`, `scripts/pdf-oracle.py`; modify `formats.js`, `format-loader.js`, `scripts/fixtures-pdf.py`, `tests/pdf-engine.test.mjs`, `docs/VERIFICATION.md`.

**Interfaces:** `openPdfSession(bytes,format)` implements the shared `FileSession`. `pdf-verify.js` exports `verifyPdfSnapshots(before,after,replacements)`; snapshots come from D1 and include exact decoded-stream hashes and original image dictionary semantics. Replacements map IDs to `{bytes,perceptual}`; retain an ID-mapping bijection during graph comparison so renumbering cannot hide aliasing changes. PDF rows expose display paths such as “Image 12 0”, but session preview IDs are opaque and validated. PDF `modes` includes lossless/colors; colour mode applies JPEG quality only, never PNG palette reduction to PDF image streams.

- [ ] Add these tests plus protected-structure regressions covering forms, links, annotations, attachments, tags, bookmarks, metadata, fonts, page boxes and shared resources. Use a `features.pdf` fixture combining these structures and one supported JPEG; independently validate it with QPDF and renderable Poppler output before testing optimization.

```js
test('PDF quality reduction preserves structure and dimensions', async () => {
  const src = await fixture('multiformat/pdf/features.pdf'), original = src.slice();
  const out = await optimizeFile(src, 'features.pdf', () => {},
    {mode:'colors',jpegQuality:70});
  assert.equal(out.extension, 'pdf');
  assert.equal(out.mime, 'application/pdf');
  assert.equal(out.converted, false);
  assert.ok(out.images.some(i => i.perceptual));
  assert.deepEqual(src, original);
  await assertPdfProtected(src, out.bytes, out.images);
});
test('unsupported PDF images remain original rather than becoming page bitmaps', async () => {
  const src = await fixture('multiformat/pdf/masks-and-colourspaces.pdf');
  const out = await optimizeFile(src, 'diagram.pdf');
  assert.ok(out.images.every(i => !i.perceptual));
  await assertPdfProtected(src, out.bytes, out.images);
});
```

Define `assertPdfProtected` in `tests/helpers/formats.mjs`: open both through D1, compare bounded snapshots with `verifyPdfSnapshots` and verify selected JPEG streams with the existing native/image oracles; the external oracle below supplies independent evidence. Add a mutation test changing a form value, link target, metadata field, page box, attachment byte and non-image stream; each must fail verification even when a page render appears unchanged. Add cyclic graphs and shared-image alias changes to defeat naive tree comparison. A text-only or already-efficient PDF may return original bytes; no-op is not an error.

- [ ] Run `node --test tests/pdf.test.mjs`; expect unsupported format/missing session before implementation.
- [ ] Inspect eligible XObjects only: eight-bit DeviceRGB/DeviceGray, one DCTDecode filter, default decode semantics, no masks/alternates. Read their exact JPEG bytes and validate dimensions against the PDF dictionary before the existing JPEG optimizer. Keep metadata/orientation and sample geometry; optimize shared streams once. In optional mode pass `jpegQuality`; in lossless mode preserve coefficients. A codec failure keeps that image and records why. Unsupported Flate/inline/JPX/JBIG2/CCITT/complex-colour images remain intact, with report rows where safely identifiable.

```js
for (const image of inspection.images) {
  if (!image.eligible) { /* append retained row with image.reason */ continue; }
  const src = await engine.readImage(image.objectId);
  const r = await optimizeImage(src, 'embedded.jpg', {}, options);
  if (r.status === 'optimized') replacements.set(image.objectId, {
    bytes:r.bytes, perceptual:!!r.perceptual
  });
  // Record the row and progress using the shared result contract.
}
```

Use QPDF stream replacement without clearing the old dictionary: retain all keys, alter encoding bookkeeping only as required, and never inject a PNG container into a PDF image stream. Writer configuration must not strip unreachable content, flatten forms, normalize page content, alter producer/date fields, downsample, prune attachments or execute anything. Perform lossless stream/object compression where legal. A runtime semantic comparison pairs graph nodes, preserves reference sharing, compares exact numbers/strings/dictionaries and unchanged decoded streams, and permits only selected JPEG stream bytes plus serialization bookkeeping. Ignore physical xref/ObjStm packaging and stream Length when justified, not arbitrary document keys. Preserve the original trailer document identifier where supported; if the writer updates a revision identifier, allow only that documented field and test it explicitly.

Reject candidate verification failures; do not offer a partial/unchecked output. Return original bytes if the complete PDF does not shrink; revert tentative report savings. Sessions retain selected image sources/output for one-pair-at-a-time previews and close all engine handles on failure/clear. Charge actual decoded data against the job budget during inspection and verification; exceeding the cap is a clear bounded failure, not a reason to skip verification.

- [ ] Run focused tests and `python3 scripts/pdf-oracle.py tests/fixtures/multiformat/pdf tests/output/multiformat/pdf`. Implement the oracle with native QPDF JSON/check, Poppler text/font inspection and page rendering, plus Pillow render comparison and native jpegtran canonical checks. Require pixel-identical lossless page renders; optional-mode rendering may differ only in selected image regions, while PDF structure, text extraction, geometry, fonts and non-image streams stay identical. Use both QPDF and Poppler so the runtime parser is not the only oracle. Run the complete unit and existing image suites; record PDF no-op/skip behavior accurately.
- [ ] Commit: `git commit -m "Optimize supported PDF images with verified document preservation"`.

### Task D3: local PDF previews, browser floors and whole-release verification

**Files:** Create `web/pdf-preview.js`, `web/pdfjs-compat.js`, `tests/pdf-browser.mjs`, `tests/pdf-renderer.test.mjs`, `tests/final-formats.test.mjs`. Modify `package.json`, `package-lock.json`, `scripts/vendor.mjs`, `web/preview.js`, `web/app.js`, `web/index.html`, `web/styles.css`, `web/core/formats.js`, `web/format-help-data.js`, `web/worker.js`, `web/job-client.js`, `tests/formats-browser.mjs`, `tests/format-help-browser.mjs`, `tests/release-transition.mjs`, `tests/live.mjs`, `README.md`, `AGENTS.md`, `docs/DEPENDENCIES.md`, `docs/VERIFICATION.md`, `docs/IMPLEMENTATION-NOTES.md`, `docs/DEPLOYMENT.md`, `docs/vendor-manifest.json`.

**Interfaces:** `createPdfPreview()` in `pdf-preview.js` returns `{show({before,after,pageNumber}),clear()}`. Extend the worker session preview protocol with a validated page-preview request for PDF only, retaining the current opaque image preview IDs. The result view exposes optional “Preview pages” in addition to changed-image buttons. Add `FileSession.pagePreview(pageNumber)` only to PDF, returning independent original/result byte copies for renderer consumption; it validates page range and never accepts external URLs. The worker/client exports `pagePreview(pageNumber)`; existing `preview(previewId)` stays image-only. Main-thread PDF preview stores one bounded source/output pair and destroys both PDF.js documents on clear; other jobs never import PDF.js.

- [ ] Before product renderer code, write browser tests that open before/after pages and changed-image previews, traverse pages, close/reselect, cancel pending render and reopen offline. Add malicious-action/remote-resource sentinel PDFs that include document/page actions, links, scripts and font/resource URLs without executing them. Test the renderer records no external requests or window openings, does not run callbacks from PDF data, and preserves app controls/job state. Test page geometry and canvas bounds; render at a maximum of four megapixels per preview canvas (this affects only preview zoom, never saved PDF resolution).

```js
await page.getByRole('button',{name:'Preview pages',exact:true}).click();
await page.locator('#pdf-before canvas').waitFor();
await page.locator('#pdf-after canvas').waitFor();
assert.equal(await page.evaluate(() => window.pdfActionExecuted), undefined);
await page.getByRole('button',{name:'Close PDF preview',exact:true}).click();
assert.equal(await page.locator('#pdf-preview').isVisible(), false);
```

Add a unit test for every registry/catalog entry and the exact 30-extension set. Write an all-enabled-format offline browser loop with explicit generated fixture mapping; check output names/MIME/conversions, every format help dialog, image previews and PDF page previews. Add a missing-PDF-worker/WASM asset test proving Ready offline cannot appear after a partial cache.

- [ ] Run `node tests/pdf-browser.mjs` and `node --test tests/final-formats.test.mjs`; expect missing preview controls/disabled PDF format and final-count failures before integration. Unit renderer tests may mock canvas only for cleanup behavior; successful render evidence requires a real browser.
- [ ] Pin `pdfjs-dist` exactly to 5.6.205 with npm integrity recorded; vendor the legacy build, worker and every local CMap/standard-font/WASM resource required by enabled rendering features, plus licenses. Inspect current security notes before installation. Use PDF.js core display API, not its general-purpose viewer/scripting manager. Configure `isEvalSupported:false`, never instantiate a scripting service, never invoke document actions, and supply only local ArrayBuffer/Uint8Array data. Embedded links are not auto-opened; imported strings stay text. Prevent external requests via API choices and CSP; resources needed by supported PDFs come only from the versioned local inventory.

Audit both PDF.js main and worker code against Safari 17/Chrome 120/Firefox 121, including syntax and APIs. Use the legacy build and explicit reviewed shims in `pdfjs-compat.js` only when needed; shims load before both contexts. Transpile syntax with existing esbuild targets where sufficient. Do not claim transpilation polyfills missing APIs or silently raise the browser floor. If that pinned version cannot meet the floor safely, select a qualified maintained build, document why and rerun the complete renderer suite. Keep the app usable for other formats when preview initialization fails, and never present an unrendered canvas as successful preview.

Budget copied PDF pairs and rendering allocations; abort oversized previews clearly while preserving the validated download. `clear()` cancels render tasks, calls PDF.js loading/document destroy, releases canvas storage and revokes Blob URLs. Page-preview responses are job-ID checked and timed out like all requests. Never let help, preview close or renderer errors revoke an unrelated valid result download. Enable PDF only after D1/D2 pass; show the supported JPEG/structural-compression limitations in its help and report.

- [ ] Run the final verification sequence from a clean isolated checkout:

```sh
npm run vendor
npm run release
npm test
npm run test:browser
node tests/formats-browser.mjs
node tests/pdf-browser.mjs
python3 scripts/image-oracle.py tests/fixtures tests/output/codecs
python3 scripts/package-oracle.py tests/fixtures/multiformat tests/output/multiformat
python3 scripts/archive-oracle.py tests/fixtures/multiformat tests/output/multiformat
python3 scripts/publication-oracle.py tests/fixtures/multiformat tests/output/multiformat
python3 scripts/pdf-oracle.py tests/fixtures/multiformat/pdf tests/output/multiformat/pdf
git diff --check
```

Include new browser scripts in package scripts exactly once. Exercise old-to-new release installation/update, missing assets, cache repair, two-window active-operation locking, BFCache lifecycle where available, timeout, preview cleanup and help during jobs. Reopen offline after Ready offline in a fresh context and process each family, checking runtime asset hashes, cached entries, request methods/origins and no imported-file persistence. Use only synthetic fixtures, including when adapting `tests/live.mjs`; do not run the new live test against the older production site or publish this release merely to make it pass.

Verify Safari/Firefox/Edge target floors and an installed PWA on available devices; report each unverified target precisely. Inspect desktop, 320px, keyboard/200% text, conversion, ORA and PDF screenshots. Record actual minified/WASM/offline payloads, peak memory measurements for tested fixtures, tested native compression variants, format-specific limits, opening/rendering evidence and application gaps. Keep long-lived artwork/documents untouched.

- [ ] Commit coherent runtime/test/docs changes with `git commit -m "Complete local multi-format optimization and offline format help"`. Use requesting-code-review for one independent whole-branch review consistent with native execution. Fix findings with failing regressions and focused reruns, then present the complete local deliverable and remaining verification limits. Do not merge, push or deploy without the applicable user instruction.
