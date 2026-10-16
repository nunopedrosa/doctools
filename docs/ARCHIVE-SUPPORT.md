# Archive engine coverage

The development engine reads TAR/PAX, 7z and RAR/RAR5 in memory. Public comic/collection routing is enabled only after its own session/browser tests pass. Native support is a tested subset, not a promise to decode every historical compression/encryption method.

- TAR/PAX: regular files/directories; supported path, timestamp, ownership and mode metadata is preserved. Links, sparse/device entries, ACLs, xattrs, unknown PAX fields, non-UTF-8 names and nonzero trailing data are rejected. Compressed outer TAR wrappers are excluded.
- 7z: tested stored/LZMA-family files, native writer round trips and Unicode names. Unsupported filters, encryption and metadata are rejected. Native allocation is capped; dictionaries that cannot fit fail without a partial result.
- RAR: stored and compressed RAR4 plus stored/compressed/solid RAR5 regression inputs are tested. RAR5 compression version 1 (RAR7), encryption, multipart/SFX, unknown sizes, nonempty entries without a file CRC and dictionaries over 256 MiB are excluded. Every decoded RAR file is independently CRC-checked in addition to backend checks.
- Input remains at most 100 MiB, expanded content 250 MiB/5,000 entries/50 MiB per entry; output is capped at 250 MiB. Native memory is capped at 512 MiB. The 7z writer's seekable scratch store is private bounded memory, released when its writer closes.

Known-package detection prevents an Office, KMZ or later supported publication package renamed ZIP from bypassing its validator. Ordinary opaque files and nested archives are retained as bytes; nested archives are not traversed. CBR/CB7/CBT will convert to CBZ with explicit container-metadata and reader-ordering caveats; ordinary TAR/7z collections keep their format. Every accepted result is reopened and checked before a download.

Synthetic fixtures and upstream regression-data provenance are in `tests/fixtures/multiformat/PROVENANCE.md`. Test tools never upload fixtures or personal records. A browser-worker suite verifies the same native module in a browser, not just Node. Physical devices, maximum-size workloads and exhaustive archive-method coverage remain unverified.
