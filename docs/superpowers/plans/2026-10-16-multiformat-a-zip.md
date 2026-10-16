# Stage A: shared registry, ZIP packages and format help

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Native execution; complete tasks A1–A4 in order and mark completed steps.

**Goal:** Add Office, Visio and KMZ through the tested ZIP engine, plus a reusable accessible format-help catalog.

**Architecture:** Introduce retained format sessions while preserving existing DOCX/image exports. Separate OPC validation from document-specific rules and use one verified ZIP replacement pipeline. Keep all main-thread format metadata free of native/parser imports.

**Tech Stack:** Existing ES modules, zip.js, xmldom and image codecs; Node test runner and Playwright.

**Spec:** [Approved specification](../specs/2026-10-16-multiformat-design.md).

## Global Constraints

All [master-plan global constraints and shared interfaces](2026-10-16-multiformat.md) apply verbatim. In particular: “Files must stay on the device, originals must remain untouched, image dimensions must remain unchanged, and exact lossless optimization remains the default.” “Exclude macro-enabled Office files, including macro-bearing content disguised with a supported extension.”

## Review Focus

- Root relationships may select a main part outside a conventional path; validate its type instead of hard-coding `word/document.xml` (A2).
- VBA/signature parts disguised as an image or unknown embedded part must fail before optimization (A2).
- Empty packages, empty image lists and out-of-order worker responses must not crash the UI (A1/A4).
- Multiple KML entries and external image hrefs must keep their exact bytes/order and make no requests (A2/A4).
- Opening help during processing, stale preview replies and session timeout must not clear a file/result or leak buffers (A1/A3/A4).

### Task A1: registry, sessions and worker lifecycle

**Files:** Create `web/core/formats.js`, `web/core/format-loader.js`, `web/core/zip-session.js`, `web/core/image-session.js`, `web/core/paths.js`, `tests/helpers/formats.mjs`, `tests/format-sessions.test.mjs`, `tests/job-client.test.mjs`. Modify `web/core/file-types.js`, `files.js`, `document.js`, `limits.js`, `web/worker.js`, `web/job-client.js`, `tests/files.test.mjs`, `scripts/release.mjs` only if inventory needs adjustment.

**Interfaces:** Implements `enabledFormats`, `formatForName`, `openFile`, `FileSession`, `Summary` and `Result` from the master. Keep `fileType` as a compatibility alias to `formatForName`. Initially enable only DOCX/PNG/JPG/JPEG. `zip-session.js` exposes `openZipSession(bytes,format,validator)`; `image-session.js` exposes `openImageSession(bytes,format)`. `paths.js` exports `safeEntryName(name)` and `resolvePackageTarget(base,target)` for validated decoded relative URI targets. The original XML `parseXml` stays available from `package.js` until A2 moves it to `xml.js`.

- [ ] Write the failing tests below, extending existing DOCX and image fixtures rather than replacing their assertions. Define test helper `fixture(name)` as `new Uint8Array(await readFile(new URL('../fixtures/'+name,import.meta.url)))` in `tests/helpers/formats.mjs`; this helper resolves `tests/fixtures/`. Check the URL resolution in its own smoke assertion.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/formats.mjs';
import {openFile} from '../web/core/format-loader.js';
test('session previews retain the source and reject arbitrary IDs', async () => {
  const src = await fixture('textured.png'), original = src.slice();
  const session = await openFile(src, 'example.PNG');
  try {
    const summary = await session.inspect();
    assert.deepEqual(summary.modes, ['lossless','colors']);
    const result = await session.optimize({mode:'colors',colors:64}, () => {});
    assert.ok(result.downloadAvailable);
    assert.equal(result.converted, false);
    const pair = await session.preview(result.images[0].previewId);
    assert.deepEqual(pair.before, original);
    await assert.rejects(() => session.preview('../../secret'), /preview/i);
    assert.deepEqual(src, original);
  } finally { await session.close(); await session.close(); }
});
```

Add a fake Worker in `tests/job-client.test.mjs` that records `terminate()` calls and can deliver an obsolete job ID after `clear()`. Use Node mock timers to advance 120,001 ms without sleeping; assert a timeout error, termination, and no obsolete result or preview event. Cover inspect, optimize, preview, cancellation and arrayBuffer rejection. Existing tests keep validating direct `optimizeFile` and `optimizeDocument` exports.

- [ ] Run `node --test tests/format-sessions.test.mjs tests/job-client.test.mjs tests/files.test.mjs`; expect the new session import/contracts to fail before product changes.
- [ ] Add immutable descriptor records and dynamic loader dispatch. Extract the existing image path and ZIP optimization loop into sessions; session preview IDs are monotonically allocated per session and map to validated image sources. Retain source/output only while the session is alive. Verify output entry sequence, protected bytes and image guards before returning a candidate; no-op results contain original bytes and `downloadAvailable:false`.

```js
// Retain convenience exports without retaining file history.
export async function optimizeFile(bytes, name, onProgress=()=>{}, options={}) {
  const session = await openFile(bytes, name);
  try { return await session.optimize(options, onProgress); }
  finally { await session.close(); }
}
```

The worker owns one session and rejects requests for stale IDs. Replace ZIP-specific preview reads with `session.preview(previewId)`. It copies/transfers only response-owned buffers; never detach session input. Add a per-request 120-second timer on the main-thread client: terminate the worker, invalidate the job ID and clear retained state on expiry. Stop/reset the timer after success, error or clear; it must not run while idle. `worker.onerror` also disposes the worker and timer. Track total decoded data once per entry; rereading for preview must not double-count the budget. `safeEntryName` rejects absolute, traversal, NUL, backslash, duplicate and drive-prefixed names; URI target resolution decodes and rejects escapes without renaming raw entry names.

- [ ] Run `npm run release`, the three focused tests and `npm test`. Confirm existing image coefficients, pixels and all DOCX fixtures still pass. Add `assert.throws(() => formatForName('x.docm'))`, and cover uppercase and multi-dot names.
- [ ] Commit the runtime/tests and matching generated release: `git commit -m "Introduce bounded format sessions without changing existing outputs"` after inspecting `git diff --check` and staged files.

### Task A2: Office/Visio/KMZ validators and fixtures

**Files:** Create `web/core/xml.js`, `web/core/opc.js`, `web/core/office.js`, `web/core/kmz.js`, `tests/office-formats.test.mjs`, `tests/kmz.test.mjs`, `scripts/fixtures-formats.py`, `scripts/package-oracle.py`. Modify `package.js`, `format-loader.js`, `formats.js`, `tests/helpers/formats.mjs`, `scripts/requirements-test.txt`, `docs/VERIFICATION.md`.

**Interfaces:** `xml.js` exports existing `parseXml`. `opc.js` exports `validateOpc(archive,format)` returning `{mainPath,types,relationships}` after common checks. `office.js` exports `validateOffice(archive,format)` returning `{imagePaths,warnings}`; it includes a distinct VSDX main-relationship definition. `kmz.js` exports `validateKmz(archive,format)` with the same validator result. `package.js` keeps `validatePackage(archive)` as a DOCX wrapper. All wrappers retain errors for the existing rejection fixtures.

- [ ] Extend the Python fixture generator to write deterministic ZIPs under `tests/fixtures/multiformat/` with fixed timestamps and ordered entries. Use the already committed `textured.png`, `photo.jpg` and `unsupported.gif`. Generate every Office variant, a realistic multi-slide/table/diagram sample when native tools allow, and the following test names. Add `fixture('multiformat/'+name)` cases to focused tests:

```js
for (const extension of ['docx','dotx','pptx','ppsx','potx','xlsx','xltx','vsdx']) {
  test(`protected package parts survive ${extension}`, async () => {
    const src = await fixture(`multiformat/mixed.${extension}`);
    const summary = await inspectFile(src, `mixed.${extension}`);
    assert.ok(summary.images.length >= 2);
    const result = await optimizeFile(src, `mixed.${extension}`);
    assert.equal(result.extension, extension);
    assert.equal(result.converted, false);
    await assertProtectedZip(src, result.bytes, result.images);
  });
}
for (const name of ['hidden-vba.pptx','vba-content-type.xlsx',
 'vba-relationship.docx','signed.vsdx','missing-image.pptx',
 'duplicate-rel.xlsx','wrong-root.potx','wrong-main-type.dotx',
 'entity.kmz','missing-kml.kmz']) {
  test(`reject ${name}`, async () => {
    await assert.rejects(() => inspectFileFixture(name));
  });
}
```

In `tests/helpers/formats.mjs`, define `inspectFileFixture(name)` using `fixture('multiformat/'+name)` and `inspectFile`. Define `assertProtectedZip(src,out,images)` to open both through existing `readArchive`, compare ordered entry names, and compare every entry's decoded bytes unless its image row says optimized. Independently check entry metadata and image invariants with Python; do not count the same production parser twice as the independent oracle.

Fixture construction rules: content-types Overrides use each main document/template/slideshow MIME; `.rels` paths resolve relative to their source part; Word main root is `w:document`, PowerPoint `p:presentation`, Excel `s:workbook`, Visio `v:VisioDocument` in its published namespace. Include a root-selected main path outside the usual directory as `relocated.pptx`; follow its valid content type/relationships. Preserve formulas, notes, comments, charts and opaque embedded-object sentinel files. KMZ fixtures include `doc.kml`, two ordered KML entries, nested relative images, external HTTPS image hrefs, model bytes and UTF-8 names. Signed/VBA fixtures include signatures/relationships/content types and suspicious parts with mismatched names.

- [ ] Run `python3 scripts/fixtures-formats.py`, then `node --test tests/office-formats.test.mjs tests/kmz.test.mjs`. Expect unsupported-format/import failures before the validators are added.
- [ ] Implement content-type/relationship validation without reserializing protected XML. Use explicit main-part type maps, check every internal target and image declaration, validate known Strict/Transitional namespaces, and reject macro/signature content across all parts. For VSDX use `http://schemas.microsoft.com/visio/2010/relationships/document` and verify its namespace/content types from Microsoft's reference before hard-coding the table. Check every main-part extension/type pairing. XML DTD/entity declarations remain rejected for UTF-8 and UTF-16.

```js
// format-loader.js only after full container validation:
const validator = format.family === 'kmz' ? validateKmz : validateOffice;
return openZipSession(bytes, format, validator);
```

KMZ selects/validates KML documents with a KML root/namespace, preserves original entry order and every KML byte, discovers bundled PNG/JPEG images without fetching hrefs, and rejects missing/malformed KML. Before generic collection handling in B, provide `recognizeZipPackage(archive)` in `opc.js` identifying OPC signatures; C extends it to ODF/EPUB/ORA. Known-but-unsupported packages cannot take the generic ZIP route.

- [ ] Run both focused tests, `npm run release`, `npm test`, and `python3 scripts/package-oracle.py tests/fixtures/multiformat tests/output/multiformat`. Implement the oracle with Python zipfile/hashlib to compare entry names/order, comments, timestamps, modes, unchanged compressed payloads where applicable and protected decoded bytes. Invoke existing image oracle for extracted images. Save outputs through the tests to ignored `tests/output/multiformat/`. Open representative outputs with Office/LibreOffice and Visio/Google Earth when available; record actual gaps.
- [ ] Commit: `git commit -m "Support Office, Visio and KMZ image packages with preservation checks"`.

### Task A3: offline catalog and accessible format dialog

**Files:** Create `web/format-help.js`, `web/format-help-data.js`, `tests/format-help.test.mjs`, `tests/format-help-browser.mjs`, `tests/helpers/browser.mjs`. Modify `web/index.html`, `styles.css`, `app.js`, `core/formats.js`, `package.json`, `scripts/release.mjs` only if needed, `README.md`.

**Interfaces:** `format-help-data.js` exports `FORMAT_HELP` keyed by each of the 30 extension IDs, with `{title,description,applications,policy,sources}`; `sources` is maintainer attribution text/URLs, not auto-fetched content. `format-help.js` exports `setupFormatHelp({formats,container,dialog})`; it creates one button per enabled format and shows the corresponding entry. It does not depend on job state. `tests/helpers/browser.mjs` exports `withBrowser(fn)` which serves `web/` on an ephemeral loopback port, launches the project's Playwright/Chromium, supplies `{page,context,baseURL}`, and always closes them. Follow the existing browser harness's MIME, no-cache and path containment rules.

- [ ] Write the unit catalog matrix for all 30 IDs and browser tests for enabled formats; examples below are executable inside `withBrowser`. Add a fixture round trip that processes a DOCX then opens/closes help and checks its download URL is still usable.

```js
for (const f of enabledFormats()) {
  assert.ok(FORMAT_HELP[f.id].description.length > 20, f.id);
  assert.ok(FORMAT_HELP[f.id].applications.length > 0, f.id);
}
await page.getByRole('button', {name:'About .vsdx', exact:true}).click();
const dialog = page.getByRole('dialog', {name:'VSDX — Visio drawing'});
await dialog.waitFor();
assert.match(await dialog.textContent(), /Microsoft Visio/);
await page.keyboard.press('Escape');
assert.equal(await dialog.isVisible(), false);
assert.equal(await page.getByRole('button', {name:'About .vsdx',exact:true})
  .evaluate(el => el === document.activeElement), true);
```

- [ ] Run `node --test tests/format-help.test.mjs` and `node tests/format-help-browser.mjs`; expect missing catalog/dialog failure before product code.
- [ ] Add dialog markup with `aria-labelledby`, description and explicit Close button. Use native `showModal()`/`close()` and its Escape behavior. Include a fallback with `role=dialog`, `aria-modal=true`, background inert state, trapped Tab/Shift+Tab, Escape and focus restoration. Populate using textContent, never HTML from a format/file. Do not let help buttons submit a form or clear job state.

```js
const button = document.createElement('button');
button.type = 'button';
button.textContent = '.' + format.extension;
button.setAttribute('aria-label', 'About .' + format.extension);
// Click handler fills a single dialog from FORMAT_HELP[format.id], then opens it.
```

Author individual entries for document, template and slideshow variants; do not label DOTX as an ordinary document. Cite official publisher support inside catalog maintainer data. Examples: Visio for VSDX, Google Earth for KMZ, corresponding Office/LibreOffice apps, Krita/MyPaint for ORA, Calibre for EPUB, Acrobat Reader for PDF, a publisher-verified reader for each comic format, and a verified archive utility for ZIP/TAR/7z. For existing PNG/JPEG use a documented image viewer such as Preview. Show conversions, ORA lossless-only, PDF supported-image limitation and input limits in policy text. Keep future descriptors disabled until their engine passes its stage.

- [ ] Run unit/browser catalog tests and check Enter/Space, Escape, Close, Tab wrapping, focus restoration, disabled native-dialog fallback, 320px viewport, 200% text and offline opening. Capture desktop/mobile screenshots. Assert help makes no requests, changes no compression setting, leaves a result download intact and remains usable during a delayed processing test. Include the script in `npm run test:browser`.
- [ ] Commit: `git commit -m "Explain every supported format in an accessible offline dialog"`.

### Task A4: integrate UI results, previews, release and stage verification

**Files:** Modify `web/app.js`, `web/index.html`, `web/job-client.js`, `web/worker.js`, `web/preview.js`, `web/manifest.webmanifest`, `tests/browser.mjs`, `tests/release-transition.mjs`, `tests/live.mjs`, `docs/VERIFICATION.md`, `README.md`, `AGENTS.md`; create `tests/formats-browser.mjs`, `tests/ui-results.test.mjs`, `web/result-view.js` if extracting result copy from app.js.

**Interfaces:** `result-view.js` exports `resultPresentation(inputName,inputSize,result)` returning `{title,savings,filename,downloadLabel}`; it is pure and used by app.js. Filenames use the last input extension, sanitize the existing unsafe characters and append `-compressed` or `-converted`, with `result.extension`. Progress uses actual work units and handles zero totals. `formats-browser.mjs` consumes `withBrowser` and the enabled registry rather than hard-coding DOCX.

- [ ] Write these failing result tests plus UI tests for empty-image packages, uppercase/multi-dot names, all Stage A formats, no-op results and opaque preview IDs:

```js
const view = resultPresentation('Volume.One.CBR', 100, {
  extension:'cbz',label:'CBZ',bytes:new Uint8Array(125),
  converted:true,changed:true,downloadAvailable:true
});
assert.equal(view.filename, 'Volume.One-converted.cbz');
assert.match(view.savings, /larger/i);
assert.doesNotMatch(view.savings, /saved/i);
```

This conversion fixture is a pure UI contract; CBR engine activation belongs to B. Existing DOCX/PNG/JPEG download names remain unchanged. For every Stage A enabled descriptor, assert a matching file accept extension, help button and accurate downloadable MIME/extension. An image-less package must never access `images[0].format`.

- [ ] Run `node --test tests/ui-results.test.mjs`, `node tests/formats-browser.mjs`; expect incorrect legacy DOCX-only UI behavior before edits.
- [ ] Drive picker copy, accepted extensions, summaries, settings capabilities and download labels from enabled descriptors/results. Standardize the picker label to “Choose a file” and update every existing browser-test selector in the same commit. Use `Summary.qualityControls` to show only relevant PNG/JPEG controls: PDF exposes JPEG quality only and ORA exposes neither. Preserve busy/update locking, error handling and input lifecycle. App preview buttons pass validated `previewId`; display `image.path` safely as explanatory text. Add conversion-aware messaging now for later adapters. Make lossless changed package images previewable as well as perceptual ones.
- [ ] Run `npm run release`, `npm test`, `npm run test:browser`, `node tests/formats-browser.mjs`, both image/package oracles. New offline contexts must cache a whole release, reopen offline and inspect/optimize every Stage A family; verify no imported bytes in Cache Storage and no requests outside same-origin GET/Blob URLs. Exercise missing new-module install, two-window updates and mismatch recovery. Record the stage result without claiming later formats implemented.
- [ ] Commit: `git commit -m "Integrate multi-format results, help and offline ZIP processing"`. Keep the live site unchanged.
