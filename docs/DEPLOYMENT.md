# Deploying smaller.basecentral.link

Doctools is a static application. Only `web/` is published. Files selected by visitors stay in browser memory; the server serves app assets only. No PHP, database, Node runtime, private document storage or background jobs are required.

## Hosting coordinates

- Public URL: `https://smaller.basecentral.link/`.
- DreamHost SSH account: `basecentral@gcx.me`, the same account as Agenda.
- Verified origin IPv4: `75.119.200.187`.
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

The DNS-only `smaller` A record currently points to the verified DreamHost origin. DreamHost must have the domain configured under `basecentral` with a trusted certificate for `smaller.basecentral.link`. Use its free Let's Encrypt certificate with automatic renewal. Check that the order is Active before calling HTTPS/PWA installation ready. The `.well-known/acme-challenge/` path remains exempt from the app's HTTP redirect for certificate issuance/renewal.

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

## Roll back

Switch `current` to the intact previous release using the same temporary-link/rename procedure. Verify its assets and HTTPS again. The service worker treats the prior code as another content-identified release; existing tabs may need **Update app** or a reload once idle. Do not delete browser caches or visitors' local data as a rollback step.

To undo first publication completely, retain the deployed release, remove only the known public symlink, and restore the recorded original-defaults directory to its original name. Never remove a directory recursively as part of this operation. Doctools stores no server-side user documents, database or app secrets to migrate.
