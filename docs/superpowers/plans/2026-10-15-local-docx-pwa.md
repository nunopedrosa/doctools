# Local DOCX image optimizer implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects that method. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a locally processing, offline-capable DOCX PWA that reduces embedded PNG/JPEG size without changing resolution, image quality, or other document parts.

**Architecture:** Static browser modules delegate inspection, optimization, and verification to a dedicated worker. Vendored ZIP and WebAssembly components perform binary-to-binary processing. A versioned service worker caches every required runtime asset; documents remain in memory.

**Tech Stack:** HTML, CSS, browser ES modules, Web Workers, WebAssembly, zip.js, OxiPNG, coefficient-preserving jpegtran, Node's test runner, Playwright, Python fixture/oracle utilities. Dependency acquisition and codec compilation are maintainer steps; serving the finished app requires no build or backend.

**Spec:** `docs/superpowers/specs/2026-10-15-local-docx-pwa-design.md` (approved 2026-10-15).

## Global constraints

- The first release supports one document at a time and strict lossless optimization only.
- Keep the existing shell tools available.
- Target desktop Safari 17+, Chrome/Edge 120+, and Firefox 121+.
- Support ordinary file selection and downloads without requiring File System Access APIs, SharedArrayBuffer, cross-origin isolation, or multithreaded WebAssembly.
- Start with conservative limits: 100 MiB input, 250 MiB total expanded package size, 5,000 entries, 50 MiB per expanded entry, and 25 megapixels per optimized image.
- Cache application assets only, never selected DOCX files or generated downloads.
- Make no runtime requests to third-party CDNs.
- Do not silently ship PNG-only optimization as completion of this design.
- Accept an optimized image only when its byte length decreases and its invariants pass.
- Do not rename media, change extensions, create relationships, modify XML, or remove document properties or embedded objects.
- Do not deploy or add a public toolbox URL until an actual destination is established.

## Review focus

1. Word packages with Strict OOXML namespaces, escaped relationship targets, shared header images, and external image links: validate internal references correctly without fetching external links (Task 2).
2. Unusual PNG metadata and progressive/CMYK JPEG variants: optimize only verified variants and retain all other original images with explanations (Task 1).
3. Central/local ZIP header disagreement and false expanded sizes: stop streaming at actual limits, reject corruption, and avoid large allocations (Task 2).
4. Cancel followed immediately by another selection: stale worker messages and download URLs must never replace the new job (Task 3).
5. Interrupted cache installation or an update during processing: never advertise incomplete offline coverage or mix release assets (Task 4).

## File map and contracts

Published files live in `web/`, keeping source documentation, tests, and `.git` outside the web root.

| Path | Responsibility |
| --- | --- |
| `web/index.html`, `web/styles.css`, `web/icons/` | Accessible UI and install artwork |
| `web/app.js` | UI state, user actions, download lifecycle |
| `web/job-client.js` | One worker per selected document, job IDs, cancellation |
| `web/worker.js` | Inspection and optimization message handlers |
| `web/core/limits.js` | Limits and counted streaming reads |
| `web/core/archive.js` | Strict ZIP read/write, metadata and unchanged-entry copying |
| `web/core/package.js` | OOXML validation, signatures, safe part resolution |
| `web/core/document.js` | Inspection, optimization, final verification |
| `web/core/images.js`, `web/core/png.js`, `web/core/jpeg.js` | Format identification, codec adapters and preservation checks |
| `web/vendor/`, `web/vendor/licenses/` | Pinned offline dependencies and attribution |
| `web/release.js`, `web/sw.js`, `web/offline.js`, `web/manifest.webmanifest` | Release asset inventory, caching, readiness, controlled updates |
| `scripts/vendor.mjs`, `scripts/build-codecs.sh` | Reproducible dependency acquisition and codec builds |
| `scripts/codec/` | Source wrappers for binaries when upstream browser APIs are insufficient |
| `scripts/fixtures.py`, `scripts/image-oracle.py` | Generated test inputs and independent image evidence |
| `tests/fixtures/`, `tests/*.test.mjs`, `tests/browser.mjs` | Integrity, codec, UI, and offline regression checks |
| `package.json`, `package-lock.json`, `.gitignore` | Maintainer dependencies, test commands, ignored temporary output |
| `AGENTS.md`, `README.md`, `docs/DEPENDENCIES.md`, `docs/VERIFICATION.md` | Shared baseline adoption, usage, provenance and actual verification |

Interfaces use Uint8Array for binary data. Define and test these exact exports:

```js
// core/images.js
// Returns original bytes for unsupported, inefficient, or failed candidates.
// status: "optimized" | "efficient" | "unsupported" | "failed"
export async function optimizeImage(bytes, path) {} // => {bytes, status, reason, format, width, height}

// core/document.js
export async function inspectDocument(bytes) {} // => {images:[{path,format,size}], entries:number}
export async function optimizeDocument(bytes, onProgress = () => {}) {}
// => {bytes, changed:boolean, images:[{path,status,reason,before,after}]}

// core/archive.js
export async function readArchive(bytes, limits) {}
// => {entries:[{name,size,directory,metadata}], read(name):Promise<Uint8Array>, close()}
export async function rewriteArchive(archive, replacements) {} // Map<string,Uint8Array> => Uint8Array

// core/package.js
export async function validatePackage(archive) {} // => {mediaPaths:string[]}; throws on invalid input

// job-client.js
export function createJobClient(onMessage) {} // => {inspect(file), optimize(), cancel(), clear()}
```

Worker requests are `{id, type:"inspect", bytes}`, `{id, type:"optimize"}`. Responses are `{id,type:"inspected",summary}`, `{id,type:"progress",done,total,path}`, `{id,type:"result",result}`, or `{id,type:"error",message}`. Transfer input and output ArrayBuffers where ownership allows. The worker retains input after inspection until clear, cancellation, or replacement. UI ignores responses from obsolete IDs.

## Task 1: Prove lossless PNG and JPEG components

**Files:** `package.json`, `package-lock.json`, `.gitignore`, `scripts/vendor.mjs`, `scripts/build-codecs.sh`, `scripts/codec/`, `scripts/fixtures.py`, `scripts/image-oracle.py`, `web/vendor/`, `web/core/images.js`, `web/core/png.js`, `web/core/jpeg.js`, `tests/codecs.test.mjs`, `tests/fixtures/`, `docs/DEPENDENCIES.md`, `AGENTS.md`.

**Consumes:** Approved image policy. **Produces:** `optimizeImage(bytes,path)` and locally loadable single-threaded codecs, with independent preservation evidence for both formats.

- [x] Record exact dependency source tags/commits, licenses, SHA-256 hashes, runtime asset sizes, and acquisition/build commands in `docs/DEPENDENCIES.md`. Review actual pinned APIs before writing adapters. Evaluate zip.js and an OxiPNG binary-input wrapper; use jpegtran's lossless coefficient transformation API, not its lossy encoder. If a prebuilt JPEG module cannot be verified, compile jpegtran with pinned Emscripten and source revisions using `-copy all -optimize`, with baseline/progressive candidates. Keep all builds single-threaded and disallow geometric transforms. Confirm required build tools exist before selecting this path; report an unavailable toolchain as a concrete blocker.
- [x] Add app instructions adopting `../pwa/AGENTS.md`, preserving the spec's browser floors and file policy. Define `npm test` as `node --test tests/*.test.mjs` and `npm run test:browser` as `node tests/browser.mjs`. Pin maintainer packages; do not add runtime network imports. Obtain bundled runtime paths with `load_workspace_dependencies` before assuming Node, Python, or Playwright locations.
- [x] Generate small original fixtures for PNG RGBA/palette/grayscale, ICC/gamma/density/EXIF/text/unknown safe chunks, APNG, JPEG EXIF orientation, density, ICC, baseline/progressive, grayscale and CMYK. Store expected original metadata alongside fixtures. Oracle script uses an independent PNG decoder and JPEG coefficient reader; include its exact pinned dependencies and commands. Tests compare metadata segment/chunk payloads as well as dimensions. Skip unsupported input variants with explicit reasons, never by changing format.
- [x] Add failing tests before codec adapters. Read fixtures directly so examples need no implicit fixture helpers:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {optimizeImage} from '../web/core/images.js';
test('animated PNG remains byte-identical', async () => {
  const original = new Uint8Array(await readFile('tests/fixtures/animated.png'));
  const result = await optimizeImage(original, 'word/media/animated.png');
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(result.bytes, original);
});
test('JPEG result never grows', async () => {
  const original = new Uint8Array(await readFile('tests/fixtures/photo.jpg'));
  const result = await optimizeImage(original, 'word/media/photo.jpg');
  assert.ok(result.bytes.length <= original.length);
});
```

- [x] Run `node --test tests/codecs.test.mjs`; establish failure because adapters do not exist. Add format sniffing, dimension limits before codec allocation, PNG metadata checks, JPEG segment checks, and binary adapters. Never enable pixel-changing OxiPNG options. Metadata loss or failed invariants retain the original with `failed` status. Extension/content mismatch and unsupported JPEG variants return `unsupported`. Catch codec exceptions per image. Require at least one genuine size reduction per codec on intentionally inefficient fixtures.
- [x] Run codec tests and `python3 scripts/image-oracle.py tests/fixtures tests/output/codecs`. The oracle must independently compare decoded PNG values (including hidden transparent values) and JPEG quantization tables, sampling and coefficient arrays plus rendering metadata. Add injected throwing-codec tests to verify original retention. Test oversized dimensions without invoking the codec. Repeat representative codec cases in the real-browser suite during Task 3; Node-only results do not establish browser compatibility.
- [x] Commit the complete tested codec and dependency unit with `git commit -m "feat: add verified lossless image optimizers"`. If either codec lacks verified preservation, do not mark this task complete.

## Task 2: Bounded DOCX processing and export verification

**Files:** `web/core/limits.js`, `web/core/archive.js`, `web/core/package.js`, `web/core/document.js`, `scripts/fixtures.py`, `tests/archive.test.mjs`, `tests/document.test.mjs`, `tests/fixtures/`.

**Consumes:** `optimizeImage` and vendored ZIP component. **Produces:** archive/package/document contracts above.

- [x] Extend the fixture generator to create valid DOCX packages containing comments, tracked changes, headers/footers, shared media, embedded objects, document properties, external links, Strict namespaces, and percent-encoded relationship targets. Include no-media and already-efficient documents. Generate separate corrupt cases for path traversal, duplicate names, CRC failure, local/central header mismatch, unknown compression, signed relationships/parts, encrypted ZIP/Office containers, missing parts, broken references, wrong content type, and each limit. Use tiny test-configured limits for expanded-byte cases; do not generate enormous archives.
- [x] Write failing integrity tests using generated archives and exact byte comparisons:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readArchive} from '../web/core/archive.js';
import {optimizeDocument} from '../web/core/document.js';
test('signed package is refused', async () => {
  const input = new Uint8Array(await readFile('tests/fixtures/signed.docx'));
  await assert.rejects(() => optimizeDocument(input), /sign/i);
});
test('unchanged document XML survives exactly', async () => {
  const input = new Uint8Array(await readFile('tests/fixtures/mixed.docx'));
  const result = await optimizeDocument(input);
  const before = await readArchive(input);
  const after = await readArchive(result.bytes);
  try {
    assert.deepEqual(await after.read('word/document.xml'),
      await before.read('word/document.xml'));
    assert.deepEqual(after.entries.map(e => e.name).sort(),
      before.entries.map(e => e.name).sort());
  } finally { before.close(); after.close(); }
});
```

- [x] Run `node --test tests/archive.test.mjs tests/document.test.mjs` and confirm the new missing exports fail. Implement strict ZIP reads, CRC verification, overlap/header validation and bounded streamed extraction. Use metadata preflight plus counted actual decompressed chunks; abort immediately when either expanded limit is exceeded. Reject names that normalize to duplicates, traversal, or ambiguous package paths. Explicitly document supported ZIP features; preserve directory entries and metadata. `readArchive(bytes, limits)` uses default limits when omitted.
- [x] Validate XML with a pinned worker-compatible parser that rejects DTD/entity expansion; do not use regular expressions as an XML parser. Resolve internal relationship targets relative to the owning part, normalize URI escaping safely, and check referenced parts/content types. Accept Transitional and Strict namespaces. Recognize signatures by both parts and relationships. Preserve external relationships as bytes and never fetch their targets.
- [x] Optimize each matching media entry sequentially; report per-image progress. Rewrite only accepted candidates using pass-through of unchanged compressed data when supported by the pinned ZIP API. Reopen output, check full entry names, CRCs, unchanged extracted bytes, and changed-image invariants. Release intermediate buffers between reads. If output is equal/larger or no candidate changes, return original bytes with `changed:false`. Surface archive failure as a job error and codec failure as an image warning.
- [x] Add tests for every corrupt fixture above, real decompression exceeding declared sizes, custom low limits, profile/unsupported-image retention, no images, equal/larger final output, and forced output-verification failure. Compare every unchanged part, not just document XML. Run the focused tests and independent image oracle on media extracted from the resulting DOCX. Confirm input remains unchanged after all paths.
- [x] Commit with `git commit -m "feat: preserve and verify DOCX packages during optimization"`.

## Task 3: Accessible browser workflow and cancellation

**Files:** `web/index.html`, `web/styles.css`, `web/app.js`, `web/job-client.js`, `web/worker.js`, `web/icons/`, `tests/browser.mjs`.

**Consumes:** `inspectDocument`, `optimizeDocument`. **Produces:** complete single-document workflow and browser test entry point.

- [x] Read the frontend-design and implementation/test workflow skills before product UI work. Create browser tests for file selection, inspection, optimize, progress, result summary, download and clear before implementing the UI. Use a local static server at a stable origin; run Playwright with the workspace's available browser binaries. Keep generated downloads in ignored `tests/output/`.

```js
// In the Playwright test body, with page supplied by a fresh browser context:
await page.goto(baseURL); // baseURL defined by the test server setup
await page.getByLabel('Choose a DOCX file').setInputFiles('tests/fixtures/mixed.docx');
await page.getByRole('button', {name:'Optimize without quality loss'}).click();
const downloaded = page.waitForEvent('download');
await page.getByRole('link', {name:'Download DOCX'}).click();
const download = await downloaded;
assert.match(download.suggestedFilename(), /-compressed\.docx$/);
```

- [x] Run `npm run test:browser` and confirm expected missing-page/control failures. Implement selection -> inspecting -> ready -> processing -> result/error state transitions. Disable conflicting actions during a job but retain Cancel and Clear. Label file input and buttons, use textContent for filenames/reasons, aria-live for status, readable focus styles, and a semantic results table/list. Display policy, limits, original/result bytes and savings; avoid false savings claims for unchanged documents.
- [x] Implement worker protocol and client contracts from the file map. Terminate workers and increment IDs on cancel/clear/reselection, discard obsolete responses, revoke old object URLs, and release references. Ensure errors re-enable selection. Require a case-insensitive DOCX extension at selection and validate package content in the worker. Successful download uses the DOCX MIME type and a sanitized filename.
- [x] Add browser regressions for uppercase extension, spoofed input, signed/encrypted files, no media, unsupported formats, repeated processing, per-image failures and job failures. Force a sufficiently slow job for cancellation; select a second file immediately and assert late first-job messages cannot change its name or download. Verify revoked URLs cannot remain active through Clear. Check filenames containing HTML remain plain text.
- [x] Test keyboard-only actions, progress announcements, 320px and desktop layouts, 200% text, clear/reselect, and image preservation after actual downloaded output. Run PNG and JPEG fixtures through the browser worker and independent output oracle. Observe requests and fail the test on any document upload or third-party origin.
- [x] Commit with `git commit -m "feat: add local DOCX optimizer interface"`.

## Task 4: Offline readiness, installation and safe updates

**Files:** `web/release.js`, `web/sw.js`, `web/offline.js`, `web/manifest.webmanifest`, `web/app.js`, `web/index.html`, `web/icons/`, `tests/offline.test.mjs`, `tests/browser.mjs`.

**Consumes:** Complete runtime file inventory and UI busy state. **Produces:** installable app with verified complete offline cache and explicit idle-only update activation.

- [x] Write failing static tests checking manifest scope/start URL, icon existence, all imported runtime paths and WASM URLs against a single release asset inventory. Keep `release.js` compatible with service-worker loading and include itself in that inventory. Include all codecs, parser, ZIP compression fallbacks, workers and styles; record total bytes.
- [x] Run `node --test tests/offline.test.mjs` to establish missing asset inventory/worker failures. Implement an all-or-nothing installation into a versioned cache; delete partial new caches on failure. Use cache-only release assets for controlled clients so network changes cannot mix versions. Limit fetch handling to same-origin app assets and scoped navigations. Never cache imported files, blobs, or document outputs. Do not use unconditional skipWaiting.
- [x] Establish a service-worker message handshake that confirms inventory completeness and active release identity. Show Ready offline only when the page is controlled by that matching release and all required assets are present. Explain preparation/failure visibly. For updates, show an idle-only reload action; block activation during inspection/optimization, and do not send skipWaiting until all controlled clients report idle. If any client is busy or unresponsive, retain the waiting release. Reload clients consistently after activation and clean only obsolete doctools caches once old clients cannot need them.
- [x] Extend browser tests with first load online, wait for readiness, go offline, close/reopen a page in the same context, and optimize a newly selected mixed-image DOCX. Inspect the download independently. Test blocked WASM during installation, deliberately removed cached binary, a second busy tab, and a new release discovered mid-job. Assert no false readiness, no interrupted processing, and no mixed-version requests. Serve release variants from temporary test directories; never alter production hosting or committed app assets to simulate updates.
- [x] Run static and browser checks. Inspect the manifest/install experience in available browser UI and installed-app context; mark unavailable contexts explicitly. Commit with `git commit -m "feat: cache complete optimizer for offline use"`.

## Task 5: Documentation, complete verification and release handoff

**Files:** `README.md`, `docx-unpack` (optimizer help text only if correction is needed), `docs/DEPENDENCIES.md`, `docs/VERIFICATION.md`, plan progress checkboxes.

**Consumes:** Measured behavior and test results. **Produces:** runnable local app instructions and an accurate verification record.

- [x] Update README with `python3 -m http.server 8000 --bind 127.0.0.1 --directory web`, the localhost URL, preparation/installation, Ready offline meaning, no-upload policy, limits, browser floors, download/clear/cancel behavior, strict lossless savings limitations, dependency maintenance, and test commands. Preserve CLI usage and identify LightImage consistently. Do not publish development paths in app UI.
- [x] Record dependency versions, hashes, licenses, source/build commands, offline asset total, representative runtime and observed memory measurements. Lower limits if measured target behavior requires it and update constants/docs/tests together. Include canonical input preservation and lack of persistent document storage; no extra backup format is needed.
- [x] Run the complete checks once final edits are in place:

```sh
python3 scripts/fixtures.py
npm test
npm run test:browser
python3 scripts/image-oracle.py tests/fixtures tests/output/codecs
git diff --check
```

- [x] Run downloaded-document oracle checks and compare all unchanged part hashes. Open representative results in Word and inspect text layout, comments, tracked changes, headers/footers and image appearance. Exercise Safari/Firefox and installed-PWA contexts if available. Record exact checks performed and outstanding checks in `docs/VERIFICATION.md`; do not imply old browser floors or unavailable devices were tested from a modern Chromium pass.
- [x] Compare representative documents with the user's LightImage workflow only if samples/settings are available; otherwise record this comparison as outstanding without blocking already proven strict lossless processing. Do not invent equivalent savings.
- [x] Perform final code review against all five Review Focus cases, spec integrity/privacy requirements, release consistency and actual downloaded outputs. Use an independent reviewer according to the user's selected execution method. Fix material findings and rerun only affected tests plus any required final consistency checks.
- [x] Commit with `git commit -m "docs: document local operation and verified compatibility"`. Report local launch instructions, actual savings evidence, tests passed, unavailable verification, and any remaining blockers. Do not deploy or register a public URL as part of this implementation.

## Plan review

Spec coverage: Task 1 owns image guarantees and dependency provenance; Task 2 owns bounded input processing and package integrity; Task 3 owns interaction, memory lifecycle and cancellation; Task 4 owns installation, complete offline coverage and update consistency; Task 5 owns usage, independent output checks and accurate verification reporting. Each Review Focus case has explicit tests in its owning task. Interface names and result status values are shared above and must remain consistent.

Recommended execution is native in this chat, followed by an independent final review. Codec, package and UI tasks depend closely on preservation contracts, so keeping the implementation context together reduces handoff overhead. Native execution was approved. Implementation and automated checks are complete; verification gaps are recorded in `docs/VERIFICATION.md`. Final independent review follows this implementation checkpoint.
