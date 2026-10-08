# Certificate PDFs

The managed-node worker renders an issued certificate's PDF once, from its
design snapshot, and stores it at
`tenants/<tenant>/certificates/<certificate>/certificate.pdf`. The download
route serves that object; without one it falls back to HTML. The worker never
renders a certificate again once `r2_object_key` is set.

## Re-rendering PDFs stored at the wrong page size

Before the page-size fix, every certificate PDF was printed on portrait A4
whatever its design, so the default 297x210 mm landscape design came out
shrunk into the top of the page. Run this once after the fix is deployed to
the worker.

It needs:

- the database **owner** URL (`DIRECT_DATABASE_URL`), as a login with
  `BYPASSRLS` (or a superuser). `certificates` forces row-level security, and
  the script refuses a login that would see only part of it;
- the API's storage settings (`STORAGE_PROVIDER=r2` and the `R2_*` values),
  so it reads and writes the same bucket;
- Chromium for `--apply`: run it in the managed-node worker image, which
  carries the script bundled as `rerender-certificate-pdfs.mjs` (the image has
  no source tree and no pnpm).

```bash
# 1. Dry run (anywhere with the env; no Chromium needed): which stored PDFs are
#    the wrong size, by certificate id. Exits 1 while any need a re-render.
DIRECT_DATABASE_URL=... <storage env> pnpm data:rerender-certificate-pdfs

# 2. One tenant first, in the worker image.
docker run --rm --env-file <worker env + DIRECT_DATABASE_URL> <worker image> \
  node rerender-certificate-pdfs.mjs --apply --tenant <tenant-id>

# 3. Everyone.
docker run --rm --env-file <...> <worker image> \
  node rerender-certificate-pdfs.mjs --apply

# 4. Confirm: exits 0.
docker run --rm --env-file <...> <worker image> \
  node rerender-certificate-pdfs.mjs
```

What it guarantees (details in `scripts/data/certificate-pdf-backfill.ts`):

- **It judges each stored file.** A PDF whose page already matches its design
  (an A4 portrait design, or one already re-rendered) is left alone, so it is
  safe to re-run and resumes where an interrupted run stopped.
- **It renders what the worker renders**: the issue-time design snapshot (else
  the template) with the same recipient, course, credential id and
  verification path.
- **It cannot write a wrong page.** `--apply` first renders a sample and
  refuses unless it comes out 297x210 mm, so an image without the fix cannot
  overwrite PDFs with A4 again. Each new PDF is checked against its design
  before it replaces the stored one.
- **The old PDF is replaced only by a good one**, in place at the same key; a
  failed render or upload leaves it as it was. No database rows change.
- **Old PDFs are not kept.** Overwriting is final unless the bucket has object
  versioning. They are the broken renders, but take a bucket snapshot first if
  you need them.

Needs review (reported, never written):

- **Unexpected key**: `r2_object_key` is not the worker's key for that tenant
  and certificate.
- **No valid design**: neither the snapshot nor the template parses as a
  certificate design document; the worker could not have rendered it either.

Each render launches Chromium (about 1.5 s each in the worker image); run large
tenants one at a time with `--tenant`.
