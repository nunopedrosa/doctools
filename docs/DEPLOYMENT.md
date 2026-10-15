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

`web/.htaccess` supplies the index, disables directory listings, declares WASM/JavaScript/manifest MIME types, requests `Cache-Control: no-cache` and redirects HTTP to the fixed HTTPS hostname. The app's service worker supplies the verified offline cache. Do not use long browser cache TTLs for mutable module URLs or `release.js`/`sw.js`.

If you later enable the Cloudflare proxy, use Full (strict) and a rule scoped only to `smaller.basecentral.link` that bypasses CDN caching and respects the origin browser TTL, as used for Agenda. Do not change other applications' DNS, certificates or cache rules. Do not use Flexible SSL or disable certificate verification to hide a broken origin certificate.

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
- Active target: `/home/basecentral/smaller-app/releases/2026.10.16.1-021043170764/web`.
- Original defaults retained at `/home/basecentral/smaller.basecentral.link.before-smaller-20261015-233223` (backup filename uses UTC; activation was 00:32 on 2026-10-16 in Lisbon).
- Private checksum/archive records: `/home/basecentral/smaller-app/incoming/2026.10.16.1-021043170764/`.
- Local pre-publication checks: 68 unit tests, full Chromium browser/offline/update suite, and 12-image independent lossless oracle passed.

Routing initially used Agenda's address, which returned DreamHost's default site. Querying DreamHost's own authoritative DNS established Smaller's distinct origin, `75.119.207.108`. Direct HTTP to that address with the Smaller hostname now returns the deployed `.htaccess` redirect and headers. The user corrected Cloudflare's Smaller A record; public DNS confirms the correct address, currently DNS-only. Cached answers may temporarily retain the old proxy addresses.

The user reports the Let's Encrypt order is still processing, also observed in the DreamHost panel. The origin still presents a self-signed certificate. Runtime file publication is complete, but the app is **not yet verified ready for public HTTPS/offline use**. No certificate bypass or weakened SSL mode was used. No changes were made to Agenda's deployment, database, configuration, DNS or cache rule.

The first explicit hosted smoke-test attempt stops at normal TLS validation with `DEPTH_ZERO_SELF_SIGNED_CERT`, before any browser/fixture work. This is an outstanding hosting prerequisite, not a passing live verification result.

Once DreamHost marks the certificate Active, verify the actual origin and run the complete public smoke test:

```sh
curl --resolve smaller.basecentral.link:443:75.119.207.108 -I https://smaller.basecentral.link/
node tests/live.mjs https://smaller.basecentral.link/
```

Both must succeed with normal TLS validation before marking publication verified. If proxying is re-enabled, additionally verify Full (strict) and the Smaller-only cache policy above. A valid Cloudflare edge certificate alone does not establish a trusted or correctly routed origin.
