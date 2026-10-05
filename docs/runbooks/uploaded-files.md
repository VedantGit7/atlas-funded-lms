# Uploaded files: content checks and serving (audit M8)

Files that members, authors and admins upload are stored in R2 (or the local
filesystem provider in development) and served back to browsers. This runbook
covers what is checked, how files are served, and what a deployment needs.

## What happens to an upload

1. **Request.** The API checks the declared type and size against the purpose
   (`backend/packages/storage/src/mime-policy.ts`, `size-policy.ts`) and signs a
   PUT URL. The signature binds `Content-Type` and, for types that must not
   render inline, `Content-Disposition: attachment`. A PUT with different
   headers is rejected by R2.
2. **Upload.** The browser PUTs the file with exactly the `requiredHeaders` the
   API returned.
3. **Confirm.** The API checks size and checksum, then reads the first 4 KB and
   requires the bytes to be what the declared type says
   (`content-sniff.ts`): a magic number for images, PDF, ZIP/PPTX, PPT and
   audio; real text that is not HTML or SVG for `text/plain` and `text/csv`.
   A mismatch deletes the object and answers `VALIDATION_ERROR`. An SVG is
   sanitized with DOMPurify's SVG profile (`svg-sanitize.ts`) and written back
   before the reference becomes `READY`.

Only a `READY` reference can be downloaded or used. Branding uploads (logo,
favicon, OG and about-school images) are finalized through
`POST /api/v1/branding/assets/confirm`; before audit M8 they had no confirm
step and never became usable.

## How files are served

| Type                                       | Served as                         |
| ------------------------------------------ | --------------------------------- |
| PNG, JPEG, WebP, ICO, audio, PDF           | inline                            |
| SVG, text, CSV, ZIP, slides, anything else | `Content-Disposition: attachment` |

`<img>`, favicons and CSS ignore `Content-Disposition`, so SVG logos still
display everywhere they are used as images; opened directly they download
instead of rendering. The disposition is stored on the object at upload,
forced again on every signed download URL (covering older objects), and set by
the local download route, which also sends `X-Content-Type-Options: nosniff`
and a sandbox CSP because it serves from the application's own origin.

OG images are raster only (PNG, JPEG, WebP).

## Deployment requirements

**R2 CORS must allow the `content-disposition` request header before this
change is deployed.** Browser uploads are cross-origin PUTs; if the bucket's
CORS policy lists only `content-type`, the preflight fails and every SVG, text,
CSV, ZIP or slide upload breaks. The policy needs, for each app origin:

```json
[
  {
    "AllowedOrigins": ["https://<tenant-or-app-origin>"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "content-disposition"],
    "MaxAgeSeconds": 3600
  }
]
```

Verify after the change: upload an SVG logo in the branding editor and a CSV
lesson attachment; both must reach `READY`.

## One-off backfill

SVGs confirmed before this change (lesson thumbnails) were stored unsanitized.
After deploying, run with the database owner connection and the API's storage
settings:

```bash
DIRECT_DATABASE_URL=... pnpm data:sanitize-svg-assets
```

The dry run reports how many need sanitizing. Re-run with `-- --apply`, then
run the dry run again and confirm it reports 0. Anything listed as "Not
processed" is missing from storage or is not a readable SVG; review those
references by id.
