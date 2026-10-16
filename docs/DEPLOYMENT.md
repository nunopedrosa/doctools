# Deploying smaller.basecentral.link

Doctools is a static application. Only `web/` is published. Files selected by visitors stay in browser memory; the server serves app assets only. No PHP, database, Node runtime, private document storage or background jobs are required.

## Hosting coordinates

- Public URL: `https://smaller.basecentral.link/`.
- DreamHost SSH account: `basecentral@gcx.me`, the same account as Agenda.
- Verified origin IPv4: `75.119.207.108` (DreamHost's authoritative Smaller A record; Agenda uses a different address).
- Domain document root: `/home/basecentral/smaller.basecentral.link`.
- Release store: `/home/basecentral/smaller-app/releases/`.
- Active link: `/home/basecentral/smaller-app/current`.
- Public link: `/home/basecentral/smaller.basecentral.link` → `/home/basecentral/smaller-app/current/web`.
- Private upload/checksum records: `/home/basecentral/smaller-app/incoming/`.

SSH uses the existing locally installed key selected by `-i ~/.ssh/chat_ssh_105`. Keep that private key on your own machine; do not copy it into this repository or the web directory. Another authorized SSH key can be substituted.

## Prepare and check a release

Run from this repository. Keep an intact previous release for rollback.

```sh
npm test
npm run test:browser
python3 scripts/image-oracle.py tests/fixtures tests/output/codecs
git diff --check
```

The independent image oracle requires the documented Python test dependencies and native jpegtran. For changed runtime assets, first run `npm run release`; commit the checked release before deployment. The generated `web/release.js` contains its release identifier, exact asset paths and SHA-256 hashes. Do not hand-edit that manifest or update a live site one runtime file at a time.

Package only the runtime assets listed in `release.js`, the manifest itself, and `web/.htaccess`. Keep the archive/checksum manifest outside the public web tree. Exclude `.git`, tests, fixture/user images, documentation, scripts, local credentials and development dependencies. The server-side `.htaccess` is intentionally outside the service-worker inventory.

For a simple manual upload from a clean, inspected `web/` directory:

```sh
tar -czf /tmp/smaller-web.tar.gz -C web .
shasum -a 256 /tmp/smaller-web.tar.gz
ssh -o IdentitiesOnly=yes -i ~/.ssh/chat_ssh_105 basecentral@gcx.me 'mkdir -p /home/basecentral/smaller-app/incoming'
scp -o IdentitiesOnly=yes -i ~/.ssh/chat_ssh_105 /tmp/smaller-web.tar.gz basecentral@gcx.me:/home/basecentral/smaller-app/incoming/
```

Choose a new release directory derived from the release identifier; never overwrite an existing release. Compare the uploaded archive checksum remotely before extracting into that private staging directory. Set public directory permissions to `0755` and regular assets to `0644`. Inspect every extracted file against the local SHA-256 manifest, including `.htaccess`. Reject unexpected files, symlinks, traversal paths or an incomplete manifest. Retain the archive and checksum record in the private incoming directory.

## Activate or update

The initial domain directory must be inspected before replacement. Back up its existing defaults as a sibling directory; never remove an existing application without first establishing what it contains. Establish the public link above only after the complete staged release is verified.

For later releases, connect with the same SSH account and switch only the `current` link. Substitute the verified release directory name below:

```sh
cd /home/basecentral/smaller-app
ln -s releases/VERIFIED_RELEASE_DIRECTORY current.next
mv -Tf current.next current
```

Use a fresh temporary link name if `current.next` already exists. Confirm the current target first; do not overwrite unrelated files or links. Renaming the link on the same filesystem makes the code switch atomic. Keep the old release until verification is complete and existing visitors have had time to update. A page loading across an update may briefly fail an asset hash check; it must retry a complete release rather than cache mixed assets.

## HTTPS, DNS and caching

The `smaller` A record must point to `75.119.207.108`; do not copy Agenda's `75.119.200.187` address. Keep it DNS-only while the certificate is being issued. DreamHost must have the domain configured under `basecentral` with a trusted certificate for `smaller.basecentral.link`. Use its free Let's Encrypt certificate with automatic renewal. Check that the order is Active before calling HTTPS/PWA installation ready. The `.well-known/acme-challenge/` path remains exempt from the app's HTTP redirect for certificate issuance/renewal.

`web/.htaccess` supplies the index, disables directory listings, declares WASM/JavaScript/manifest MIME types, disables inherited `mod_expires` rules, removes duplicate cache/expiry headers, sends `Cache-Control: no-cache` and redirects HTTP to the fixed HTTPS hostname. The app's service worker supplies the verified offline cache. Do not use long browser cache TTLs for mutable module URLs or `release.js`/`sw.js`.

With the Cloudflare proxy enabled, prefer Full (strict) and use a rule scoped only to `smaller.basecentral.link` that bypasses CDN caching and respects the origin browser TTL, as used for Agenda. Do not change other applications' DNS, certificates or cache rules. Do not use Flexible SSL or disable certificate verification to hide a broken origin certificate.

Official references: [DreamHost Let's Encrypt setup](https://help.dreamhost.com/hc/en-us/articles/216539548-Adding-a-free-Let-s-Encrypt-certificate), [Cloudflare browser cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/).

## Verify the live release

```sh
curl -I http://smaller.basecentral.link/
curl -I https://smaller.basecentral.link/
curl -I https://smaller.basecentral.link/sw.js
curl -I https://smaller.basecentral.link/vendor/jpeg.wasm
```

Require HTTP → HTTPS, valid TLS without bypasses, status 200 for app assets, `no-cache` and correct MIME types. Download all runtime assets and compare their SHA-256 values to the local release; exclude the serving configuration from HTTP downloads because `.htaccess` should be inaccessible.

In a fresh browser context, wait for **Ready offline**, then verify DOCX and standalone PNG/JPEG processing and previews. Disconnect, reload, and repeat with synthetic fixtures. Assert only same-origin GET requests and local Blob URLs; selected files must not be uploaded or appear in Cache Storage. Check private repository paths such as `/.git/config`, `/README.md`, `/tests/` and `/scripts/` are unavailable. Do not upload a personal document as a hosting probe.

The explicit hosted smoke test performs these checks against the checked-out release, validates all asset hashes and headers, and writes screenshots/downloads under ignored `tests/output/live/`:

```sh
node tests/live.mjs https://smaller.basecentral.link/
```

It requires trusted TLS and the existing Playwright/Chromium development dependencies. It never disables certificate validation. The browser selects only synthetic local fixtures; file processing remains in its worker with no uploads.

## Roll back

Switch `current` to the intact previous release using the same temporary-link/rename procedure. Verify its assets and HTTPS again. The service worker treats the prior code as another content-identified release; existing tabs may need **Update app** or a reload once idle. Do not delete browser caches or visitors' local data as a rollback step.

To undo first publication completely, retain the deployed release, remove only the known public symlink, and restore the recorded original-defaults directory to its original name. Never remove a directory recursively as part of this operation. Doctools stores no server-side user documents, database or app secrets to migrate.

## First deployment record — 2026-10-16

- Runtime release: `2026.10.16.1-021043170764`.
- Source commit: `d9943ba` (application implementation `9485f27`, plus hosting configuration).
- Uploaded archive SHA-256: `bfde0afd62347c0daa77f163e04e9313d9afe11f4207c5d1999a72c27c8cacdb`.
- Verified all 43 published files remotely: 42 runtime assets plus `.htaccess`.
- Initial target: `/home/basecentral/smaller-app/releases/2026.10.16.1-021043170764/web` (superseded by the configuration correction below).
- Original defaults retained at `/home/basecentral/smaller.basecentral.link.before-smaller-20261015-233223` (backup filename uses UTC; activation was 00:32 on 2026-10-16 in Lisbon).
- Private checksum/archive records: `/home/basecentral/smaller-app/incoming/2026.10.16.1-021043170764/`.
- Local pre-publication checks: 68 unit tests, full Chromium browser/offline/update suite, and 12-image independent lossless oracle passed.

Routing initially used Agenda's address, which returned DreamHost's default site. DreamHost's authoritative DNS established Smaller's distinct origin, `75.119.207.108`; the user corrected the record. The certificate was initially processing, and the first smoke test correctly stopped at normal TLS validation. That initial prerequisite is now resolved.

## Final activation and verification — 2026-10-16

- Both the public HTTPS URL and the direct DreamHost origin validate with normal trusted TLS; no certificate bypass was used.
- Smaller's A record points to `75.119.207.108`, with Cloudflare proxying enabled.
- Active release: `/home/basecentral/smaller-app/releases/2026.10.16.1-021043170764-apache2`; `current` points to this directory. Runtime assets and version are unchanged.
- Serving-configuration source: `3764897`; `.htaccess` SHA-256: `44486c8272cc41265e07adc34a85bf4bf63c367be487bd36956f4398359ba8b6`. All 43 files were checked against the release's private `SHA256SUMS` before activation.
- Inherited Apache expiry rules originally added a second 30-day cache header. The corrected `.htaccess` disables those rules and sends a single `no-cache` header without `Expires`.
- Cloudflare rule **smaller_cache** is Active: `(http.host eq "smaller.basecentral.link")`, cache eligibility **Bypass cache**, Browser TTL **Respect origin TTL**. This overrides the zone's four-hour browser TTL for Smaller. Agenda's existing rule is unchanged.
- Cloudflare's zone encryption mode was observed as **Full**, with automatic mode enabled. Full (strict) remains the preferred setting; the zone-wide mode was left unchanged because it affects other applications. Direct-origin TLS was independently validated.

When staging from an existing hosted release, copy only the checksum-manifest allowlist of regular files. DreamHost may inject a `.dh-diag` symlink into a hosted directory; recursive directory copying can follow host-managed links and fail. A failed private staging directory was retained as `2026.10.16.1-021043170764-apache2-incomplete`; it was never activated. The successful release excludes that injected diagnostic tree. The original complete release and defaults backup remain intact.

The complete hosted smoke test passed after cache-policy propagation: all 42 asset hashes, MIME types, revalidation headers and private-path checks passed. Chromium 153.0.8010.12 reached **Ready offline**, reopened offline, then compressed synthetic JPEG, PNG and DOCX fixtures with working image previews. Standalone downloads matched local codec outputs. Only runtime assets were cached, and no file uploads or external app requests occurred. Outputs/screenshots are under ignored `tests/output/live/`.

No changes were made to Agenda's application, database, DNS or cache rule. The shared zone SSL mode was inspected without modification. Runtime binary revalidation was not bypassed to make these checks pass.

## Multi-format release — 2026-10-16

The user authorized deployment of the 30-extension expansion on `codex/multiformat`. It supersedes the earlier DOCX/image production release. Deployment requires the complete new `web/` inventory (including QPDF, archive and PDF.js binaries/resources/licenses), regenerated hashes and a new verified release. Do not copy only HTML/JS from this expansion onto the older release.

- Runtime release: `2026.10.16.1-9bf4afa41b2b`; application source commit `2a90d9a`.
- Active target: `/home/basecentral/smaller-app/releases/2026.10.16.1-9bf4afa41b2b`.
- Previous intact rollback target: `releases/2026.10.16.1-021043170764-apache2`.
- Archive SHA-256: `c143a050635b9fdc414cedf3a67b14dad4cdea8bea5330cae79759c82ee3235b`.
- Private upload/activation records: `/home/basecentral/smaller-app/incoming/2026.10.16.1-9bf4afa41b2b/`, including the archive, source metadata and activation.json.
- The archive contains only 278 inventory-listed runtime assets, `.htaccess`, and the private `SHA256SUMS` record outside `web/`. Every member was checked before extraction; extraction accepted only regular allowlisted files. All 279 public files were hashed again before activation. File/directory permissions are `0644`/`0755`; the private checksum record is `0600`.
- Activation checked the previous `current` target, created a fresh temporary symlink and atomically replaced only `current`. Old releases and the public link were retained. No Agenda, DNS, certificate, Cloudflare rule or other application changes were made.
- HTTP redirects to HTTPS. Direct-origin trusted TLS and PDF WASM `application/wasm` / `no-cache` headers pass. Public verification checks all 278 assets against local SHA-256 and requires correct MIME/revalidation headers, plus inaccessible private repository paths.

The expanded offline set includes PDF fonts/CMaps/decoder resources. The hosted smoke test allows up to 180 seconds for first-install caching (the older 45-second test window was too short over the public connection); per-file processing deadlines remain 120 seconds. Asset verification uses bounded batches of eight requests, and each public fetch has a 30-second timeout. No personal files are used as deployment probes.

A fresh hosted browser completed offline installation in **73 seconds** over the verification connection. This is a measured first-install time for the full asset set, not a processing-time guarantee. Subsequent disconnected visits use the completed cache. One expanded test attempt exposed a Playwright fixture payload type error; the harness now passes actual Node Buffers under each explicit extension. This affected the verification harness, not the published runtime.

**Final hosted smoke test passed:** Chromium 153.0.8010.12 validated all 278 public runtime asset hashes/MIME/cache headers and private-path protections, reached Ready offline, closed/reopened disconnected, then processed every one of the 30 enabled extensions offline. Image previews, clickable format descriptions and PDF original/result page rendering worked. Cached URLs were limited to the runtime inventory; selected files/results were not cached. Recorded app traffic contained only same-origin GETs/local Blob URLs, with zero uploads and no external destinations. PDF action/script sentinel remained unexecuted. Screenshots/downloads are retained under ignored `tests/output/live/` in the execution checkout. The updated `tests/live.mjs` retains this full-format coverage for future deployments.

Current release rollback command (retain all release directories): create a fresh temporary symlink under `/home/basecentral/smaller-app` to `releases/2026.10.16.1-021043170764-apache2`, then atomically replace `current` as described above and verify HTTPS/assets again. Existing open tabs can choose **Update app** once idle to load the new release.
