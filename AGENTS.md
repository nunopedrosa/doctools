# Doctools

Before making changes, read `../pwa/AGENTS.md` as the shared trekm PWA baseline. This app's own instructions add its domain rules, compatibility floor and storage/backup requirements.

- Runtime is in `web/`; serve that directory only. Keep CLI tools working.
- Strict lossless PNG/JPEG optimization only. Preserve all non-image package bytes, media paths, image dimensions, pixels or JPEG coefficients, and metadata. Never substitute lossy re-encoding.
- Documents stay in memory. No uploads, analytics, accounts, remote runtime dependencies, or saved document history.
- Target desktop Safari 17+, Chrome/Edge 120+, Firefox 121+. No SharedArrayBuffer or required special filesystem APIs.
- Limits: 100 MiB input, 250 MiB expanded package, 5,000 entries, 50 MiB per expanded entry, 25 megapixels per optimized image. Enforce actual streaming output limits.
- Canonical originals are the user's input DOCX files. Downloads are new files; never overwrite originals. Cache app assets only.
- Keep release asset inventory, service worker and offline modules consistent. Verify offline processing after reload.
- Run `npm test`, `npm run test:browser`, and the independent image oracle for runtime changes. Record verification gaps accurately.
- Approved specification and implementation plan are in `docs/superpowers/`.
