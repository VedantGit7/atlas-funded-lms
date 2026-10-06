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

## Deployment requirements: R2 CORS

Browsers PUT uploads straight to R2 with a presigned URL, from the tenant's own
host. That is a cross-origin request, so the browser first sends a CORS
preflight, and R2 answers it from the bucket's CORS rules. The presigner signs
`content-type` and `content-disposition`, so the browser sends both, and the
bucket must allow both. **If the rules allow only `content-type`, every SVG,
text, CSV, ZIP and slide upload fails before it starts.** Image, PDF and audio
uploads keep working, which makes the breakage easy to miss.

The rule is managed in code (`backend/packages/storage/src/r2-cors.ts`, which
also defines the headers the presigner signs, so the two cannot drift):

```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["content-type", "content-disposition"],
  "MaxAgeSeconds": 3600
}
```

**Why any origin.** Uploads come from every tenant host, including custom
domains added at any time; a list of origins breaks uploads on each new custom
domain until someone edits the bucket, and keeping it in sync automatically
would put bucket-admin credentials in the runtime. The origin check adds no
protection here: the presigned URL is the credential (one key, one type, one
disposition, minutes to expiry), R2 receives no cookies, and anyone holding a
URL can use it from any HTTP client. Only `PUT` is allowed; downloads are
navigations and `<img>` loads, which need no CORS.

### Applying it

Once per bucket (staging, then production), before deploying audit M8, with
an R2 API token that has **Admin Read & Write** on that bucket. Use that token
for this command only; the runtime keeps its object-only token.

```bash
# Dry run: current rules, whether uploads pass, what --apply would write,
# and a live preflight. Exits 1 while uploads would fail.
R2_ACCOUNT_ID=... R2_BUCKET_NAME=... R2_ACCESS_KEY_ID=<admin token id> \
R2_SECRET_ACCESS_KEY=<admin token secret> PLATFORM_HOST=<platform host> \
  pnpm storage:r2-cors

# Apply: writes the upload rule, keeps any non-upload rules (e.g. GET for a
# public bucket), then probes until R2 serves it. Exits 0 when it does.
... pnpm storage:r2-cors -- --apply
```

It probes from the platform host and from a stand-in custom domain, with the
exact request a browser sends to a presigned upload URL. Nothing is uploaded.
Exit codes: `0` uploads pass, `1` they would fail, `2` it could not run (for
example a token without admin rights).

If the command cannot be used, set the rule above in the Cloudflare dashboard
(R2 → bucket → Settings → CORS policy), then run the dry run to verify it.

### Watching it

At startup the API sends the same preflight (`check-r2-upload-cors.ts`) and
logs:

- `storage.r2_cors_ok`: uploads will work;
- `storage.r2_cors_misconfigured` (error): R2 refuses the preflight, and every
  browser upload of a signed type will fail. Run `pnpm storage:r2-cors -- --apply`;
- `storage.r2_cors_check_failed` (warning): R2 could not be reached; not a CORS
  verdict.

Alert on `storage.r2_cors_misconfigured`. The check never delays readiness.

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
