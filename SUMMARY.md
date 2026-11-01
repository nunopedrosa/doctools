# Doctools / Smaller — discussion conclusions

Compiled on 2026-10-24 from the project conversation, approved specifications, implementation notes and verification/deployment records. The project discussions reviewed run from 2026-10-15 through 2026-10-17. This document records the final decisions, including changes that superseded the original DOCX-only proposal. Historical verification is identified as such; no new production check was performed for this summary.

## Handover purpose and starting point

This document is intended to carry project context from the user's company ChatGPT Business account to a private account because the company is ending its subscription. It is written to stand on its own without access to the previous chats. Chat identifiers and local paths below are provenance and navigation aids; the decisions themselves are recorded here.

The agreed product scope has been implemented and historically deployed. There is no outstanding approval needed to finish the original 30-format expansion. Remaining items are the verification gaps below and a local checkout discrepancy: the newer 200 MiB/update/reporting/six-minute changes exist in a separate managed checkout, while this working copy still contains the earlier runtime. Do not mistake that older code for a reversal of the later decisions.

For a future assistant, the essential context is:

> Continue the Doctools / Smaller project using SUMMARY.md as the discussion handover. Preserve local/offline processing, in-memory files, untouched originals, exact lossless defaults and all 30 approved extensions. Optional PNG/JPEG quality reduction is explicitly authorized; ORA remains lossless-only. The latest agreed package input ceiling is 200 MiB and complete optimization has a six-minute deadline, with two-minute inspection/preview deadlines. Read AGENTS.md and the shared PWA baseline, then inspect the actual Git state and the newer recorded commits before changing code. Reconcile any older instructions or implementation with the later decisions explicitly. Treat past test/deployment results as historical evidence and run the checks appropriate to new work. Ask the user what work to undertake next; this handover does not authorize a new feature or deployment.

The user chose implementation directly in the main conversation (called **native execution** in the planning workflow), followed by independent review. That choice referred to how development was organized, not to requiring an installed native application or helper service.

## Purpose and overall direction

Turn the original DOCX unpack → LightImage → repack workflow into a standalone, local-first PWA. The repository remains **Doctools**; the published application is **Smaller**, at [smaller.basecentral.link](https://smaller.basecentral.link/).

The chosen approach is a fully local browser optimizer: select one file, inspect it, optimize supported embedded or standalone images, review savings and previews, and download a separate result. It follows the shared trekm PWA baseline while remaining a separate application and repository. The original `docx-unpack` and `docx-pack` command-line tools remain available.

Files and results stay in memory. There are no uploads, accounts, analytics, tracking, cloud processing or saved file history. Only application assets are cached. The user's original files are the canonical copies; downloads never overwrite them.

## Compression: exact lossless by default, stronger reduction by choice

The main conclusion from comparing LightImage outputs was that unchanged resolution does not imply unchanged pixels. LightImage's much larger savings on the supplied examples came from PNG color reduction and lossy JPEG recompression. Matching those savings required separately authorized optional modes.

**Exact lossless remains the default.** PNG output must retain every decoded pixel, including transparency and supported 16-bit samples. Equivalent PNG representations, such as an exact palette or removal of an unused alpha channel, are acceptable when metadata permits. An early guard that rejected all representation changes was corrected because it discarded useful, genuinely lossless savings. JPEG lossless optimization preserves quantized coefficients and metadata; it never applies a lower quality setting.

**Smaller file (quality reduction)** requires explicit selection:

- PNG: maximum palettes of **32, 64, 128 or 256 colors**, with **128** as the default. Dimensions and alpha samples stay unchanged, but RGB values can change. The color-reduction path has a separate 4-megapixel limit and falls back conservatively for unsupported representations or metadata.
- JPEG: quality **70** as the default optional setting, preserving dimensions, component sampling, orientation and original APP/COM metadata. Quality is an encoder parameter, not a percentage of retained visual quality. Unsupported color spaces or variants use lossless/unchanged fallback.
- Both modes preserve image formats, media paths, dimensions, orientation and metadata. No resizing or metadata stripping is used to obtain savings. Before/after previews are necessary because invisible differences cannot be guaranteed.
- Keep the smallest valid candidate among the original, lossless result and selected quality-reduced result. Preserve unsupported images rather than forcing a conversion.

The supplied examples established the trade-off, without promising comparable results for every file:

| Example | Exact lossless | Optional reduction | LightImage comparison |
| --- | --- | --- | --- |
| PNG, 499,645 bytes, 597 × 1067 | 339,511 bytes; 32.0% saved | 56,632 bytes at 64 colors; 88.7% saved | 59,138 bytes; 88.2% saved, with a 30-color palette and changed RGB values |
| JPEG, 2,036,321 bytes, 2160 × 3840 | 9.8% saved | 808,996 bytes at quality 70; 60.3% saved | 790,030 bytes; 61.2% saved, using stronger quantization |

Additional palette choices, custom values and target-size optimization were discussed as possibilities. The user concluded that more options were unnecessary; none became an agreed feature. The requested follow-up was clearer per-image savings reporting.

## Final supported scope: 30 extensions

The original DOCX-only scope was expanded first to standalone PNG/JPEG, then to all the following families. Visio and OpenRaster were briefly deferred, then explicitly brought into the same delivery. Macro-enabled Office formats were explicitly excluded.

| Family | Accepted extensions | Output decision |
| --- | --- | --- |
| Word | DOCX, DOTX | Same format |
| PowerPoint | PPTX, PPSX, POTX | Same format |
| Excel | XLSX, XLTX | Same format |
| Visio | VSDX | Same format; preserve diagram structure |
| Google Earth | KMZ | Same format; optimize bundled images without fetching links |
| OpenDocument | ODT, ODS, ODP, ODG, OTT, OTS, OTP, OTG | Same format |
| Ebooks | EPUB | DRM-free EPUB 2/3; same format |
| PDF | PDF | Same format; preserve document semantics |
| Layered artwork | ORA | Same format; exact lossless only |
| Comics | CBZ, CBR, CB7, CBT | CBZ; non-CBZ inputs are explicitly labeled conversions |
| Image collections | ZIP, TAR, 7z | Keep the original archive format |
| Standalone images | PNG, JPG, JPEG | Keep the original image format |

This is extension coverage with validated variant limits, not a promise to accept every file carrying those suffixes. Exclusions include legacy binary Office, macro-bearing documents, encrypted/password-protected or signed documents, DRM, unsupported archive variants, multipart/self-extracting archives, compressed outer TAR wrappers and recursive processing of nested archives. Opaque nested resources are preserved rather than unpacked. Standard EPUB font obfuscation is permitted only under the validated font-only rules.

CBR → CBZ was expressly accepted as the practical alternative to RAR writing. CB7 and CBT follow the same conversion policy. Preserve page names, folders, order and comic metadata; disclose container-metadata and reader-ordering limitations. A converted comic remains downloadable even when larger, with the increase shown explicitly.

For same-format results, offer a compressed download only if the complete result is smaller. A valid file with no eligible images or no useful reduction is a supported no-op.

## Preservation and format-specific conclusions

Validate actual content and container structure, not just extensions. For packaged formats, preserve all non-image extracted bytes, image paths, entry order and supported archive metadata. XML, relationships, text, formulas, cached values, comments, tracked changes, embedded objects and other resources are not rewritten. ZIP offsets and container bytes may change. Known typed packages renamed as generic archives must not bypass their validators.

Reopen and verify every result before offering it. A per-image optimization failure retains the original image and reports why; corruption, unsafe structure or failed output-integrity verification prevents export. Never repair questionable input silently, execute imported scripts/macros, refresh links or fetch external resources.

Important format decisions:

- **Office/Visio:** use shared package validation with format-specific relationships and content types. Discover images through package declarations and relationships rather than assuming `word/media/`. Preserve vector diagrams, charts, formulas and other document data.
- **OpenDocument/EPUB:** preserve mandatory package conventions, including the first uncompressed `mimetype` entry. Preserve publication text, navigation, fonts and all renditions.
- **OpenRaster:** optimize layers, stored composite and thumbnail losslessly while retaining required PNG encodings. Quality reduction is disabled because independently quantizing layers and composites can make them inconsistent. Do not flatten artwork.
- **PDF:** use a dedicated object parser/writer, not ZIP handling or whole-page rasterization. Optimize eligible embedded JPEG image objects and verified structural compression; preserve unsupported streams and complex color/mask cases. Preserve text, geometry, fonts, forms, links, annotations, attachments, tags and metadata through semantic graph verification. Local page previews use PDF.js core with scripting, eval and action execution disabled. Preview rendering is separate from saved PDF contents and does not establish structural preservation by itself.

## Interface and daily workflow

Select or drop one file, inspect it, choose the mode, optimize with progress and Cancel available, review the report, preview changed images, and download a new file. Clear releases the current job and result. Changing compression settings invalidates the old result so a stale download cannot be mistaken for the new setting.

Image previews support fit-to-window and **100% actual pixels**, with synchronized scrolling. Load only one before/after pair at a time and release preview resources when closed, cleared or replaced. PDFs also offer bounded original/result page comparisons.

Every listed extension has its own clickable, offline format-description dialog with a plain-language explanation, application examples and relevant limitations. Dialogs support keyboard activation, Escape/Close, focus trapping/restoration and narrow layouts, without resetting the selected file, processing job or download.

The final reporting request added **Saved (KiB)** per image, shown to two decimal places with exact saved bytes in a tooltip. Unchanged images show zero savings. Whole-file and per-image savings remain distinct because package overhead also affects the final size.

## Limits and processing time: latest agreed values

The initial 100 MiB input ceiling was a protective memory choice, not a format restriction. The user subsequently requested **200 MB**, implemented and documented as **200 MiB** for documents/archives. Expanded-data and image limits were retained.

| Resource | Final recorded limit |
| --- | --- |
| Document/archive/PDF input | 200 MiB |
| Standalone image input | 50 MiB |
| Expanded package / output | 250 MiB |
| Archive entries | 5,000 |
| Each expanded archive entry | 50 MiB |
| Optimized image | 25 megapixels; larger embedded images stay unchanged, larger standalone images are rejected |
| PNG color reduction | 4 megapixels |
| Native WASM linear memory | 512 MiB per module |
| PDF-specific budgets | 1,000 pages, 50,000 indirect objects, 250 MiB cumulatively decoded streams |
| Complete optimization, including writing and verification | 6 minutes |
| Inspection and previews | 2 minutes |

Enforce actual streamed/decoded/output sizes, not just declared header sizes. Limits are ceilings, not assurances that every device can handle the largest permitted input.

The six-minute optimization window followed the user's report of a timeout approximately halfway through quality reduction of a **157 MB PPTX containing 260 images**. Progress messages do not extend the hard deadline. Cancel terminates the worker; cancellation or timeout leaves the original unchanged. That actual presentation was not supplied or benchmarked, so completion within six minutes remains unconfirmed.

## Architecture, offline operation and updates

Use static HTML/CSS/JavaScript under `web/`, with archive handling and codecs in workers. Serve **only `web/`**, using HTTPS or stable localhost; direct `file://` launch is outside the supported workflow. Ordinary browser file selection and downloads are sufficient. No required SharedArrayBuffer, special filesystem permissions, local native service or remote runtime dependency.

Retain zip.js for ZIP packages and pass-through preservation; use OxiPNG/exact PNG decoding and a coefficient-preserving libjpeg-turbo wrapper for images. Non-ZIP archives use a bounded in-memory libarchive WASM engine; PDF uses QPDF plus separate PDF.js previews. Heavy engines initialize when needed. Native scratch storage stays in bounded memory without filesystem access. Dependencies, binaries, source hashes, licenses and rebuild instructions are pinned and documented; insecure planned dependency versions were replaced before shipping.

**Ready offline** means the complete advertised runtime, including codecs and all format engines, is cached and the page is service-worker controlled. It is separate from network connectivity. Cache eviction or clearing site data requires reconnecting and preparing the app again. Installation is optional and gives the same processing features as browser use.

Keep release inventories, hashes and service-worker caches consistent. Content-derived release identities and verified complete caches prevent mixed-version execution. Failed update preparation must preserve the working release.

The later update request added **Check for updates**, plus automatic checks at startup, foreground and online events with a five-minute throttle. Manual checks bypass the throttle. Checking discovers/prepares a release; activating it still requires **Update app** and the existing multi-window idle lock. Finish or cancel work in every app window before activation, then reselect the file after reload.

Target desktop browsers remain **Safari 17+, Chrome/Edge 120+, Firefox 121+**. These targets must be distinguished from environments actually tested. Small-screen layout is supported; large-file mobile processing is not verified.

## Publication and release conclusions

The user authorized hosting at `smaller.basecentral.link` using Agenda's DreamHost account. The initial DNS/certificate and inherited cache-header problems were resolved before reporting trusted HTTPS and hosted offline success. Smaller remains a separate app; subsequent releases must preserve other applications and shared hosting settings.

Deploy a complete, checked runtime into a new release directory, verify checksums, then atomically switch the active symlink. Keep previous releases for rollback. Do not expose repository history, tests, documentation, credentials or selected user files under the public web root. Deployment is a separately authorized operation, not an automatic consequence of editing the project.

The 30-format release was published on **2026-10-16**. Later **2026-10-17** releases added update checks, 200 MiB inputs, per-image KiB savings and the six-minute optimization window. The latest release recorded in the reviewed discussion is **`2026.10.17.2-81caafa1ca6a`**, application commit **`8d60167`**, with hosted verification recorded in **`b07a520`**. This is historical release evidence, not a fresh assertion of today's live version.

## Verification conclusions and remaining gaps

Required runtime verification includes `npm test`, `npm run test:browser` and the independent image oracle. The expansion also added format, archive-engine, PDF and independent package-preservation checks. Test fixtures are synthetic or have recorded provenance; personal files are not uploaded or committed as fixtures.

Recorded results:

- The completed 30-format expansion passed **171 unit tests**, browser/offline/update/help suites and independent oracles for 12 images, 11 Office/KMZ packages, 8 comic/archive outputs, 14 publication/artwork outputs and 7 PDFs.
- The later update/input/reporting and timeout releases passed **174 unit tests**, browser/offline suites and the 12-image oracle. Hosted checks recorded all 30 extensions processing offline, previews, update controls, per-image savings, runtime-only caches and zero uploads/external app requests. The latest release checked 279 runtime asset hashes and headers.
- Independent application evidence includes LibreOffice/Poppler comparisons for DOCX and representative PPTX/XLSX/ODP/ODS, Krita opening/exporting ORA with identical rendered pixels, EPUBCheck validation of EPUB 2/3 outputs, and native QPDF/Poppler PDF checks.
- Independent review findings were fixed with regressions, including deployment-transition/history lifecycle problems, JPEG metadata after scan data, streaming ZIP output bounds, a KMZ typed-package bypass and package-root relationship handling. No unresolved concrete correctness finding remained in those reviews.

Outstanding evidence remains explicit: direct Microsoft Office/Visio/Google Earth UI checks, a separate EPUB-reader UI, minimum-version browsers, actual installed-PWA windows, physical devices/touch/BFCache, full manual screen-reader evaluation and near-limit peak-memory benchmarks. Modern Chromium and small fixtures do not establish these. The user's 157 MB presentation has no measured completion result.

## Checkout discrepancy and source references

At the time of writing, this checkout is at **`eb408e9`**, the merge of the 30-format work. Its `AGENTS.md`, README and runtime still describe/enforce **100 MiB inputs and two-minute optimization**, and its deployment record ends with the 2026-10-16 release. Those files therefore lag the later discussion conclusions above.

The later implementation and records are present in the managed checkout at `/Users/nfp/.codex/worktrees/smaller-multiformat/doctools`, through **`b07a520`**, including **`61bcb51`** (updates/200 MiB/savings) and **`8d60167`** (six-minute optimization). This summary records that distinction; creating it does not synchronize branches or change runtime requirements in this checkout.

For migration, retain the complete repository, this document, the `docs/` decision/verification records, and the newer managed checkout or a Git backup containing its commits. Commit hashes identify work but do not contain it; this summary cannot reconstruct the source changes if those Git objects are lost. Preserve the sibling PWA repository's `AGENTS.md` as well, or supply a reviewed copy of that baseline when relocating the project, because the local instructions reference it explicitly. Keep hosting access and private credentials separate from this document and the public app assets.

The concrete continuation task, if the user requests synchronization, is to inspect both checkouts and preserve their changes, bring the recorded later implementation into the intended development branch, align the older instructions and documentation with it, and rerun the required runtime checks. Do not blindly replace the working directory or redeploy an older release. No branch synchronization, Git backup, account transfer or deployment was performed as part of writing this handover.

Sources used:

- Project chat **“Propose local doctools PWA”** (`01a14146-7e5e-7b12-adaa-47a68ac31629`), reviewed from the initial proposal through the six-minute release.
- [Project instructions](AGENTS.md) and the explicitly adopted sibling `../pwa/AGENTS.md` baseline.
- [Initial design](docs/superpowers/specs/2026-10-15-local-docx-pwa-design.md), [multi-format design](docs/superpowers/specs/2026-10-16-multiformat-design.md), their [implementation plans](docs/superpowers/plans/) and the [execution ledger](docs/superpowers/2026-10-16-multiformat-execution.md).
- [README](README.md), [implementation decisions](docs/IMPLEMENTATION-NOTES.md), [dependencies](docs/DEPENDENCIES.md), [archive coverage](docs/ARCHIVE-SUPPORT.md), [verification](docs/VERIFICATION.md) and [deployment/rollback](docs/DEPLOYMENT.md).
- Later managed-checkout [verification records](/Users/nfp/.codex/worktrees/smaller-multiformat/doctools/docs/VERIFICATION.md) and [deployment records](/Users/nfp/.codex/worktrees/smaller-multiformat/doctools/docs/DEPLOYMENT.md), including their 2026-10-17 sections. These local references depend on retaining that checkout; the commit identities above identify the recorded changes.

The chat **“Add Windows Portuguese keyboard fix”** was also checked because it was associated with this working directory. The user explicitly classified it as a separate project, so its keyboard-layout discussions are outside this summary.
