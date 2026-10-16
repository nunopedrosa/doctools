# Stage B: comics and image archives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Native execution after Stage A; complete B1–B3 sequentially.

**Goal:** Support CBZ/CBR/CB7/CBT and ZIP/TAR/7z image collections with explicit comic conversions and bounded native decoding.

**Architecture:** Reuse the ZIP session for CBZ/ZIP. Wrap libarchive with a small in-memory C/JavaScript bridge for TAR, 7z and RAR; never extract to the host filesystem. Reuse the image engines and session preview contract.

**Tech Stack:** libarchive 3.8.10, liblzma 5.8.2, zlib 1.3.1, Emscripten 4.0.18, existing ZIP/PNG/JPEG engines.

**Spec:** [Approved specification](../specs/2026-10-16-multiformat-design.md).

## Global Constraints

All [master-plan global constraints and interfaces](2026-10-16-multiformat.md) apply verbatim. “For same-format output, retain the complete original if the rebuilt file does not shrink.” “For comic conversion, offer the converted CBZ even if larger, clearly report the size increase and never call it a saving.” “Native module linear memory is bounded at 512 MiB, and every job has a 120-second timeout with termination-based cancellation.”

## Review Focus

- RAR4/RAR5 and solid 7z reads must enforce actual decoded bytes before returning them (B1/B2).
- TAR links, sparse entries, devices, ACLs and unsupported metadata must not become ordinary files silently (B1/B2).
- Conversion can increase size; files and page names/order must remain intact while archive-only metadata differences are disclosed (B2/B3).
- A recognized Office/EPUB/KMZ/ORA container disguised as ZIP cannot bypass its validator (B2, extended by C).
- Cancelling native decode/write/preview must terminate the job and invalidate all subsequent responses (B1/B3).

### Task B1: reproducible bounded libarchive bridge

**Files:** Create `scripts/native-sources.lock.json`, `scripts/build-archives.sh`, `scripts/codec/archive.c`, `web/core/archive-native.js`, `web/vendor/archive.js`, `web/vendor/archive.wasm`, `web/vendor/licenses/libarchive.txt`, `web/vendor/licenses/liblzma.txt`, `web/vendor/licenses/zlib.txt`, `tests/native-archive.test.mjs`, `scripts/fixtures-rar.py`, `docs/ARCHIVE-SUPPORT.md`. Modify `scripts/vendor.mjs`, `scripts/fixtures-formats.py`, `docs/DEPENDENCIES.md`, `docs/vendor-manifest.json`.

**Interfaces:** Implements `openNativeArchive(bytes,container)` from the master. Expose C functions prefixed `ds_arc_`: `open(ptr,len,format) -> handle`, `next(handle) -> status`, `entry_json(handle) -> UTF8 pointer`, `read_chunk(handle,maxBytes) -> length`, `chunk_data(handle) -> byte pointer`, `rewind(handle) -> status`, `writer_open(format) -> writer`, `writer_header(writer,jsonPtr) -> status`, `writer_chunk(writer,ptr,len) -> status`, `writer_finish(writer) -> status`, `result_data(writer)`, `result_size(writer)`, `error(handle)`, `close(handle)`. Status distinguishes end from corruption/unsupported; 0-length directory data is not an error. Free every allocation on exceptions and close. `archive-native.js` owns the bridge and never lets callers retain a view into mutable WASM memory.

- [ ] Generate deterministic TAR/7z fixtures with native tools and stored RAR4/RAR5 fixtures from the published RAR headers using `scripts/fixtures-rar.py`; no commercial encoder is required. The RAR generator must construct length/CRC-correct main, file and end headers around synthetic PNG/JPEG and ComicInfo.xml bytes, with a comment explaining each field and a link to RAR's official technical note. Independently list/extract the generated files with installed bsdtar before accepting them. For compressed/solid RAR and 7z cases, select small redistributable upstream libarchive regression fixtures, decode their uuencoding and retain provenance, license and expected payload hashes in `tests/fixtures/multiformat/PROVENANCE.md`. They can exercise no-image paths; stored custom comic fixtures exercise actual image optimization.

```js
test('RAR4 and RAR5 decode exact synthetic page bytes', async () => {
  for (const variant of ['rar4','rar5']) {
    const h = await openNativeArchive(
      await fixture(`multiformat/${variant}.cbr`), 'rar');
    try {
      assert.deepEqual(h.entries.map(e => e.name),
        ['pages/001.png','pages/002.jpg','ComicInfo.xml']);
      assert.deepEqual(await h.read('pages/001.png'), await fixture('textured.png'));
    } finally { await h.close(); await h.close(); }
  }
});
```

Add corrupt/truncated header and stream checks, encrypted headers/entries, false size declarations, huge dictionary/expanded data, Unicode names, 5,001 entries, special files, duplicate/traversal paths, unsupported compression, multipart RAR and signed/multipart 7z fixtures. Error messages must identify unsupported versus damaged input. Test smaller injected limits by allowing a test-only limits argument to `openNativeArchive`; production callers always pass the frozen defaults.

- [ ] Run `node --test tests/native-archive.test.mjs`; expect missing native module/import failures before building. Confirm the new fixture bytes independently with bsdtar and 7zz/7z where available; do not label an unverified RAR encoder output a successful fixture.
- [ ] Acquire official pinned source releases, inspect security notices, verify upstream release signatures/checksums, then record actual source archive SHA-256 and full source commit in the lock file. Build liblzma and zlib statically for wasm32 with programs/tests disabled; build libarchive with only required formats/codecs and no process/filesystem extraction helpers. Respect upstream licenses including subcomponent notices, not just a guessed top-level identifier.

```sh
# build-archives.sh inputs; scripts fail if any are absent/unverified.
: "${EMSDK:?Emscripten 4.0.18 directory required}"
: "${LIBARCHIVE_SOURCE:?Verified libarchive 3.8.10 required}"
: "${XZ_SOURCE:?Verified XZ 5.8.2 required}"
: "${ZLIB_SOURCE:?Verified zlib 1.3.1 required}"
# Link archive.c plus the built static wasm archives, never host libraries:
# -O2 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node
# -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912
# -sFILESYSTEM=0; export only ds_arc_* bridge functions, malloc/free and HEAPU8.
```

Use libarchive's memory/callback APIs, `archive_read_support_format_tar/7zip/rar/rar5`, no external filters, and TAR/PAX/7z writer APIs. Do not enable compressed outer TAR wrappers. Return the detected native format and compare it to the requested container. Reject encryption even if the decoder could prompt for a password. Reject symlink/hardlink/sparse/device entries and unsupported flags/extended metadata before optimization. Meter each returned chunk and aggregate extraction, including data on skipped files. Read or validate every entry before inspection succeeds. Bound declared dictionary requirements before allocating when exposed; catch allocation failure and report a limit error. Termination is the backstop for opaque native work.

Native read/write handles are per session; keep no global archive cache. Preserve names/order and representable timestamps, permissions and directory records. A writer that cannot reproduce required metadata fails verification; never mask that failure as successful optimization.

- [ ] Run focused native tests in Node and a dedicated real-worker browser round trip, including termination during a solid archive decode. Compare repeated builds' binary hashes; record reproducibility or identified nonsemantic build variation and the source/toolchain hashes. Record payload sizes. Run `npm run vendor`, `npm run release`, `npm test`; ensure browser imports never request Node built-ins or remote modules.
- [ ] Commit: `git commit -m "Add bounded reproducible native archive reader and writers"`.

### Task B2: comic/collection sessions and independent preservation oracle

**Files:** Create `web/core/collections.js`, `web/core/archive-session.js`, `tests/collections.test.mjs`, `tests/comics.test.mjs`, `scripts/archive-oracle.py`. Modify `core/formats.js`, `format-loader.js`, `opc.js`, `tests/helpers/formats.mjs`, `scripts/fixtures-formats.py`, `docs/ARCHIVE-SUPPORT.md`.

**Interfaces:** `collections.js` exports `validateCollection(archive,format)` returning `{imagePaths,warnings}` after known-package recognition and entry checks. `archive-session.js` exports `openArchiveSession(bytes,format)` using ZIP or native handles and the shared `FileSession` interface. `openNativeArchive` retains the master interface. The independent oracle reads TAR with Python tarfile, ZIP with zipfile, and 7z/RAR with native tools into temporary test directories after checking names/types; it does not import product code.

- [ ] Write the following positive matrix and explicit nonshrinking conversion/no-op tests. Generate the same ordered synthetic pages plus ComicInfo.xml, a notes file, directory entries, an unsupported GIF and an opaque nested archive in each supported container. The nested archive remains byte-identical and is never traversed.

```js
for (const [input, output] of [
  ['cbz','cbz'],['cbr','cbz'],['cb7','cbz'],['cbt','cbz'],
  ['zip','zip'],['tar','tar'],['7z','7z']
]) {
  test(`collection ${input} -> ${output}`, async () => {
    const src = await fixture(`multiformat/pages.${input}`);
    const result = await optimizeFile(src, `pages.${input}`, () => {},
      {mode:'colors',colors:64,jpegQuality:70});
    assert.equal(result.extension, output);
    assert.equal(result.converted, input !== output);
    assert.equal(result.downloadAvailable, result.changed || result.converted);
    await assertCollectionPreserved(src, input, result.bytes, output, result.images);
  });
}
```

Define `assertCollectionPreserved` in `tests/helpers/formats.mjs`: use `readArchive` for ZIP/CBZ and `openNativeArchive` for TAR/CBT/7z/CB7/RAR/CBR, compare the ordered names and all nonoptimized decoded file bytes, and compare supported metadata for same-format cases. Add oracle runs to independently verify this rather than relying on product parsers alone. Test archive comments, metadata unsupported by ZIP conversion and already efficient pages. A larger converted CBZ stays downloadable with warnings. Same-format outputs that grow return exact original bytes.

- [ ] Run `node --test tests/collections.test.mjs tests/comics.test.mjs`; expect unsupported-extension/session errors before dispatch is enabled.
- [ ] Implement native/ZIP routing, image-signature checks and safe handling of directories/opaque entries. For generic ZIP, call package recognition before treating it as a collection; test signed DOCX renamed `book.zip`, macro PPTX renamed ZIP, and malformed recognized KMZ. Later C adds ODF/EPUB/ORA signatures to the same recognizer. For each native comic conversion, write a ZIP/CBZ preserving entry sequence, filenames and all ordinary bytes; disclose metadata not representable in ZIP instead of silently claiming complete container equivalence.

```js
const converted = format.outputExtension !== format.extension;
const useCandidate = converted || candidate.length < input.length;
return {
  bytes: useCandidate ? candidate : input,
  changed: useCandidate && !equal(candidate,input), converted,
  downloadAvailable: converted || (useCandidate && candidate.length < input.length),
  extension: format.outputExtension, mime: format.outputMime,
  label: format.outputLabel, images: committedImageRows, warnings
};
```

`equal` is the existing byte-equality helper from `png.js`; `committedImageRows` reverts tentative image savings/perceptual flags when the whole candidate is discarded. Do not claim optimized row savings for a retained original. Session previews reopen the validated input/output container and extract only one authorized resource pair; they must also work for RAR input and ZIP output.

- [ ] Run the two tests, the native test, `python3 scripts/archive-oracle.py tests/fixtures/multiformat tests/output/multiformat`, `npm run release`, `npm test`. Verify raw page data, ComicInfo.xml, order, directories, Unicode names and same-format metadata in each oracle report. Document tested compression variants and rejected cases rather than claiming every RAR/7z method is supported.
- [ ] Commit: `git commit -m "Optimize comic and image archives with explicit CBZ conversion"`.

### Task B3: browser/offline/native lifecycle and conversion copy

**Files:** Modify `tests/formats-browser.mjs`, `tests/format-help-browser.mjs`, `tests/ui-results.test.mjs`, `web/app.js`, `web/result-view.js`, `web/core/formats.js`, `web/format-help-data.js`, `web/offline.js` if progress cannot represent native assets, `web/sw.js` only if cache logic changes, `README.md`, `AGENTS.md`, `docs/VERIFICATION.md`, `docs/DEPENDENCIES.md`.

**Interfaces:** Continue the master `Result` and A4 `resultPresentation`; collection families expose the same settings and preview workflow as packages. Format-help content for CBR/CB7/CBT explicitly says CBZ output and possible size increase/reader ordering differences. TAR/7z ordinary collections retain their original format.

- [ ] Add browser tests using all seven B2 fixtures, offline reload, downloads, original/result preview natural dimensions, and retained settings after help. Include a nonshrinking conversion and assert “larger” plus “Download CBZ”; forbid negative “saved” copy. Force worker delay at the fixture transport/mock boundary to test cancellation/reselection, not by slowing production codecs.

```js
await context.setOffline(true);
await page.reload();
await page.getByText('Ready offline',{exact:true}).waitFor();
await page.getByLabel('Choose a file',{exact:true})
  .setInputFiles('tests/fixtures/multiformat/pages.cbr');
await page.waitForFunction(() => !document.querySelector('#optimize').disabled);
await page.getByRole('button',{name:'Optimize without quality loss',exact:true}).click();
await page.getByRole('link',{name:'Download CBZ',exact:true}).waitFor();
assert.match(await page.locator('#result').textContent(), /convert/i);
```

Stage A must standardize the picker label to “Choose a file”; update old browser selectors consistently. Add a test blocking `archive.wasm` that proves first-install Ready offline does not appear. After preparing all assets, selecting a CBR offline must not attempt downloads of libraries or source data. Assert no selected names or imported-file bytes appear in Cache Storage.

- [ ] Run `node tests/formats-browser.mjs`; expect missing new-format UI/copy or offline inventory assertions until integrated.
- [ ] Enable B formats only after B1/B2 pass; make conversion explanatory copy explicit at inspection and result. Update catalog examples from verified publisher support; do not claim a reader supports all four comic containers without evidence. Include all native JS/WASM/licenses in the release manifest and show truthful offline preparation progress/size. Keep native execution lazy while offline caching includes all enabled engines. Dispose preview buffers/handles on clear and timeout.
- [ ] Run `npm run release`, `npm test`, `npm run test:browser`, `node tests/formats-browser.mjs`, existing image oracle and new package/archive oracles. Compare native handle counts before/after repeated jobs in a development-only exported diagnostics path (omit diagnostics from shipped bridge exports); browser timeout/cancel tests must observe terminated workers and no stale output. Inspect desktop/320px conversion and help screenshots.
- [ ] Commit: `git commit -m "Verify offline comics, archives and conversion results"`. Keep the live site unchanged.
