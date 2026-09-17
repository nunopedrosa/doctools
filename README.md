# DOCX Image Tools v2

This version keeps the original DOCX package intact and updates only the image files under `word/media/`.

That is safer than reconstructing the whole DOCX ZIP from scratch.

## 1. Unpack

```bash
./docx-unpack GreenMarine_D5.4_v1.0_old.docx
```

This creates:

```text
GreenMarine_D5.4_v1.0_old_docx/
```

The images are normally in:

```text
GreenMarine_D5.4_v1.0_old_docx/word/media/
```

Compress those images with BestImager.

Important:
- Keep every filename exactly the same.
- Keep every extension exactly the same.
- Do not add replacement files with new names.

## 2. Repack

```bash
./docx-pack GreenMarine_D5.4_v1.0_old.docx GreenMarine_D5.4_v1.0_old_docx
```

This creates:

```text
GreenMarine_D5.4_v1.0_old-compressed.docx
```

The script copies the original DOCX and replaces only files already present under `word/media/`.

The original DOCX is not modified.
