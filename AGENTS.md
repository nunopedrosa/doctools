# Doctools

Before making changes, read `../pwa/AGENTS.md` as the shared trekm PWA baseline. This app's own instructions add its domain rules, compatibility floor and storage/backup requirements.

- Runtime is in `web/`; serve that directory only. Keep CLI tools working.
- Accept DOCX and standalone PNG/JPEG files, one at a time. Exact lossless PNG/JPEG optimization is the default. An explicitly selected smaller-file mode may reduce PNG colors (32–256) or JPEG quality (default 70), with before/after previews. Preserve all non-image package bytes, media paths, image dimensions, transparency, orientation and metadata in both modes. JPEG coefficients remain unchanged in lossless mode. Never apply quality/color reduction in lossless mode. The user approved these scope extensions on 2026-10-15/16.
- Files stay in memory. No uploads, analytics, accounts, remote runtime dependencies, or saved file history.
- Target desktop Safari 17+, Chrome/Edge 120+, Firefox 121+. No SharedArrayBuffer or required special filesystem APIs.
- Limits: 100 MiB DOCX input, 50 MiB standalone image input, 250 MiB expanded package, 5,000 entries, 50 MiB per expanded entry, 25 megapixels per optimized image. Reject larger standalone images; preserve larger embedded images. PNG color reduction has a separate 4-megapixel limit. Enforce actual streaming output limits.
- Canonical originals are the user's input files. Downloads are new files; never overwrite originals. Cache app assets only.
- Keep release asset inventory, service worker and offline modules consistent. Verify offline processing after reload.
- Run `npm test`, `npm run test:browser`, and the independent image oracle for runtime changes. Record verification gaps accurately.
- Approved specification and implementation plan are in `docs/superpowers/`.
