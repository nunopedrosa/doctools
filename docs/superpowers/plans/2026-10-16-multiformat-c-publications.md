# Stage C: OpenDocument, OpenRaster and EPUB

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Native execution after A and B; complete C1–C3 sequentially.

**Goal:** Support all eight approved OpenDocument extensions, lossless layered OpenRaster and DRM-free EPUB 2/3, with format-specific validation.

**Architecture:** Each format supplies a validator to Stage A's shared ZIP session. Preserve protected XML and resources verbatim, keep mandatory mimetype entries in their required physical position/encoding, and reject unsupported encryption/signatures. ORA adds explicit mode and PNG constraints.

**Tech Stack:** Existing zip.js, xmldom and PNG/JPEG codecs; Python/Pillow and native readers for independent checks; EPUBCheck for conformance where available.

**Spec:** [Approved specification](../specs/2026-10-16-multiformat-design.md).

## Global Constraints

All [master-plan global constraints and interfaces](2026-10-16-multiformat.md) apply verbatim. “Optimize supported PNG layer files, merged image and thumbnail using exact lossless mode only.” “Do not execute publication scripts or fetch remote resources.” “Ready offline means all advertised format engines are cached.”

## Review Focus

- A rewritten mimetype entry must remain physically first, stored, correctly encoded and without a trailing newline (C1/C2).
- A package declaring font obfuscation is not necessarily DRM; font bytes and identifiers must remain exact (C1).
- ORA palettes, bit depth, thumbnails, blend modes and merged images must remain consistent with unchanged layer pixels (C2).
- Relative/percent-encoded image hrefs, nested layers and multiple EPUB renditions must resolve within the package without fetching URLs (C1/C2).
- Generic ZIP input cannot bypass these validators, nor can a stale smaller-file mode apply colour reduction to ORA (C2/C3).

### Task C1: OpenDocument and EPUB package validators

**Files:** Create `web/core/odf.js`, `web/core/epub.js`, `web/core/zip-package-kind.js`, `tests/odf.test.mjs`, `tests/epub.test.mjs`, `scripts/publication-oracle.py`; modify `opc.js`, `collections.js`, `formats.js`, `format-loader.js`, `zip-session.js`, `scripts/fixtures-formats.py`, `tests/helpers/formats.mjs`, `docs/VERIFICATION.md`.

**Interfaces:** `validateOdf(archive,format)` and `validateEpub(archive,format)` return the Stage A `{imagePaths,warnings}` validator result. Move known-package recognition to `zip-package-kind.js`, exporting `recognizeZipPackage(archive) -> Promise<family|null>` and `assertZipPackageKind(archive,format)`, and keep an OPC re-export for compatibility. Recognize OPC, KMZ, ODF, EPUB and ORA; generic archive sessions reject recognized packages rather than optimizing them through an unvalidated path. Use `resolvePackageTarget` and `parseXml` from A.

- [ ] Generate one ordered mixed-image package for ODT/ODS/ODP/ODG/OTT/OTS/OTP/OTG and both EPUB versions. Add EPUB multi-rendition, shared-cover, nested percent-encoded image href, navigation/spine, scripted XHTML, opaque CSS/font, obfuscated font and no-image fixtures. The generator writes exact stored mimetype bytes first. ODF type map uses `application/vnd.oasis.opendocument.` plus `text`, `spreadsheet`, `presentation`, `graphics`, or those values plus `-template`. Preserve content.xml, styles.xml, meta.xml and manifest.xml sentinel data. Build invalid-root/type, traversal target, duplicate manifest ID, missing spine target, malformed container, signed/encrypted/unknown algorithm and renamed ZIP cases.

```js
for (const extension of ['odt','ods','odp','odg','ott','ots','otp','otg','epub']) {
  test(`preserve publication ${extension}`, async () => {
    const src = await fixture(`multiformat/mixed.${extension}`);
    const out = await optimizeFile(src, `mixed.${extension}`, () => {},
      {mode:'colors',colors:64,jpegQuality:70});
    assert.equal(out.extension, extension);
    await assertProtectedZip(src, out.bytes, out.images);
    const a = await readArchive(out.bytes);
    try {
      assert.equal(a.entries[0].name, 'mimetype');
      assert.equal(a.entries[0].metadata.compressionMethod, 0);
    } finally { await a.close(); }
  });
}
test('font obfuscation remains intact and is not mistaken for DRM', async () => {
  const src = await fixture('multiformat/obfuscated-font.epub');
  const out = await optimizeFile(src, 'book.epub');
  await assertProtectedZip(src, out.bytes, out.images);
  assert.ok(out.images.length > 0);
});
```

Add a matrix rejecting `encrypted.odt`, `signed.ods`, `signed.epub`, `drm.epub`, `unknown-encryption.epub`, `encrypted-image.epub`, `bad-spine.epub`, `bad-container.epub`, and `odf-as-zip.zip`/`epub-as-zip.zip`. A damaged native-format package must not be treated as a generic ZIP. These fixture names are produced by the generator in this task.

- [ ] Run `python3 scripts/fixtures-formats.py` and `node --test tests/odf.test.mjs tests/epub.test.mjs`; expect disabled/missing validator failures before implementation.
- [ ] Validate root MIME/type, XML roots/namespaces, manifests, local targets, ODF content document type and template pairing. For EPUB traverse every rootfile/package document, check unique IDs and spine references, resolve local PNG/JPEG resources without rewriting manifests, and preserve remote resource declarations without fetching. Reject signatures from file/manifest declarations, not just filename guesses. Reject actual encryption while allowing known font-only obfuscation algorithms from the EPUB specifications; preserve corresponding encryption.xml bytes and obfuscated fonts unchanged. Unknown algorithms or image/content encryption fail the whole job.

```js
// Every recognized publication must match its descriptor before shared processing.
await assertZipPackageKind(archive, format);
const validators = {odf:validateOdf, epub:validateEpub};
const validation = await validators[format.family](archive, format);
// imagePaths contains existing validated package entries, never fetched URLs.
```

Output validation repeats all input rules and checks the local ZIP header position/method for mimetype, not merely central-directory order. Preserve package entry ordering and bytes outside optimized images; reject invalid original mimetype instead of “repairing” it without approval.

- [ ] Run focused tests, full unit suite, `npm run release` and `python3 scripts/publication-oracle.py tests/fixtures/multiformat tests/output/multiformat`. Implement the oracle using Python zipfile plus struct to inspect the first local header, hash protected bytes and compare spine/manifest/ODF structure independently. Run EPUBCheck on valid original/output EPUBs; open representative ODF/EPUB outputs in LibreOffice/Calibre or available readers and record exact tools/versions/gaps. Store provenance for any generated test fonts; prefer tiny self-created font bytes for preservation-only tests and a licensed valid font for real rendering fixtures.
- [ ] Commit: `git commit -m "Support validated OpenDocument and EPUB image optimization"`.

### Task C2: OpenRaster validation and exact layer preservation

**Files:** Create `web/core/ora.js`, `tests/ora.test.mjs`; modify `zip-session.js`, `formats.js`, `format-loader.js`, `zip-package-kind.js`, `scripts/fixtures-formats.py`, `scripts/publication-oracle.py`, `tests/helpers/formats.mjs`.

**Interfaces:** `validateOra(archive,format)` returns `{imagePaths,warnings,modes:['lossless'],imageConstraints}`. Extend `openZipSession` so per-image constraints are checked after codec verification; `imageConstraints` maps path to allowed bit-depth/colour/interlace properties. Generic adapters without this field keep their existing behavior. ORA returns exact pixels for layers, composite and thumbnail; its `FileSession.optimize` rejects `options.mode==='colors'` even if called outside the UI.

- [ ] Generate `layers.ora` with a correct composite and thumbnail using synthetic Pillow layers. Include nested stacks, offsets, 50% opacity, visibility, non-default blend metadata, Unicode names, extension entries and supported alpha PNGs. Use fixtures whose composite can be verified by the simple authored blend, not guessed by production code. Add missing layer/composite/thumbnail, incorrect mimetype position/method, malformed stack, invalid thumbnail dimensions/interlace, traversal layer src and damaged PNG cases.

```js
test('ORA is lossless-only and preserves every layer pixel', async () => {
  const src = await fixture('multiformat/layers.ora');
  const info = await inspectFile(src, 'drawing.ora');
  assert.deepEqual(info.modes, ['lossless']);
  await assert.rejects(() => optimizeFile(src, 'drawing.ora', () => {},
    {mode:'colors',colors:32}), /lossless/i);
  const out = await optimizeFile(src, 'drawing.ora');
  assert.equal(out.mime, 'image/openraster');
  await assertProtectedZip(src, out.bytes, out.images);
  assert.ok(out.images.every(i => !i.perceptual));
});
```

Include `thumbnail-8bit.ora` where an otherwise lossless optimizer would choose an illegal thumbnail representation: retain that original resource. Verify ORA renamed ZIP is rejected as a collection. Existing acceptable 8/16-bit merged image and transparent layer cases must remain processable.

- [ ] Run `node --test tests/ora.test.mjs`; expect missing ORA dispatch/mode constraint failures before implementation.
- [ ] Implement strict stack/resource/path validation. Never reserialize stack.xml or infer a new layer order. Preserve offsets, opacity and blend settings as exact XML bytes. Check `mimetype` is exactly `image/openraster`, first/stored; require the composite and thumbnail resources and their published pixel/encoding constraints. Apply exact lossless codecs to eligible PNGs, then enforce ORA-specific representation constraints and keep originals for incompatible codec candidates. Do not independently quantize a composite and layers.

```js
if (!validation.modes.includes(options.mode || 'lossless')) {
  throw Error('OpenRaster supports exact lossless optimization only.');
}
// After normal image verification, retain src when imageConstraints[path] rejects
// the candidate representation; report why that image was kept unchanged.
```

- [ ] Run focused tests, `npm run release`, `npm test`, and the publication/image oracles. Extend the independent oracle to compare all layer/composite/thumbnail decoded samples, image geometry, stack bytes and original/output composite render pixels. Open in Krita/MyPaint where available and report any remaining application checks; do not add a compositor dependency just to optimize unchanged layer pixels.
- [ ] Commit: `git commit -m "Optimize OpenRaster losslessly while preserving layered artwork"`.

### Task C3: capability-aware UI, publication help and offline integration

**Files:** Modify `web/app.js`, `web/core/formats.js`, `web/format-help-data.js`, `tests/formats-browser.mjs`, `tests/format-help-browser.mjs`, `tests/format-help.test.mjs`, `README.md`, `AGENTS.md`, `docs/VERIFICATION.md`, `docs/DEPENDENCIES.md`.

**Interfaces:** UI consumes `Summary.modes` and `Summary.qualityControls`; adapters enforce the same capability independently. Enabled catalog grows by ten extensions (eight ODF, ORA, EPUB). `withBrowser`, `FileSession`, format help and result presentation remain unchanged.

- [ ] Add a browser regression selecting smaller-file mode for a PNG, then selecting ORA. Assert the select resets visibly to lossless with explanatory policy text, the forbidden option is disabled, and the worker result is nonperceptual. Returning to PNG restores availability without implicitly enabling quality reduction. Opening ORA help must describe lossless-only and Krita/MyPaint; opening each ODF template shows its template purpose.

```js
await page.getByLabel('Compression mode').selectOption('colors');
await page.getByLabel('Choose a file',{exact:true})
  .setInputFiles('tests/fixtures/multiformat/layers.ora');
await page.waitForFunction(() => !document.querySelector('#optimize').disabled);
assert.equal(await page.getByLabel('Compression mode').inputValue(), 'lossless');
assert.equal(await page.locator('#mode option[value="colors"]').isDisabled(), true);
assert.match(await page.locator('#mode-policy').textContent(), /OpenRaster.*lossless/i);
```

The code snippet uses ordinary Playwright in the repository's developer tests. Add no-image and unsupported-resource summaries, multi-rendition EPUB report/preview paths and active-script sentinel fixtures that must produce no network requests or document execution.

- [ ] Run `node tests/formats-browser.mjs` and `node tests/format-help-browser.mjs`; verify the new capability/reset and help assertions fail before UI changes.
- [ ] Update UI mode availability from the inspected descriptor, with an explicit explanation on capability reset. Do not change settings when opening help. Enable these formats only after validator/oracle tests pass. Include all new modules in release inventory and update policy text to describe preserved publication layout/resources without claiming all image codecs can shrink. EPUB scripts are opaque protected data, never injected into the DOM. ORA source/composite previews use the standard image pair view.
- [ ] Run `npm run release`, `npm test`, `npm run test:browser`, all format browser tests and package/archive/publication/image oracles. Reopen offline and optimize ODF, EPUB and ORA; test pop-ups, cancellation, reselection, update protection and same-origin GET-only traffic. Capture 320px/desktop screenshots for format help and ORA policy.
- [ ] Commit: `git commit -m "Integrate offline publications, layered artwork and capability help"`. Keep the live site unchanged.
