import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

/**
 * Give the FundedBeyond tenant its own branding assets in a local environment.
 *
 * Background: `frontend/apps/web/src/lib/server/bootstrap.ts` used to overwrite
 * every tenant's `logoLightUrl`/`logoDarkUrl`/`faviconUrl` with
 * `/brand/avatar-gradient.svg` — FundedBeyond's monogram — so *every* academy
 * rendered tenant #1's mark. Removing that override was the fix, but it exposed
 * two things the override had been hiding in the dev database:
 *
 *   1. FundedBeyond's `tenant_branding` row was still `status = 'DRAFT'`, so
 *      `readRuntimeBrandingProjection` (which requires PUBLISHED) returned no
 *      `publicName` and the UI fell back to the literal "Academy".
 *   2. FundedBeyond had no logo asset at all — the override meant it had never
 *      needed one.
 *
 * This script fixes both *as tenant data*, which is the point: the mark belongs
 * to the FundedBeyond tenant, not to the platform. Re-runnable.
 *
 * Usage: pnpm db:seed:fundedbeyond-branding
 */

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const SOURCE_LOGO = path.join(repoRoot, "frontend/apps/web/public/brand/avatar-gradient.svg");
const TENANT_SLUG = "fundedbeyond";

loadEnv({ path: path.join(repoRoot, ".env.local") });

const rawStorageRoot = process.env.STORAGE_LOCAL_ROOT ?? ".storage";
const storageRoot = path.resolve(repoRoot, rawStorageRoot);
const bucket = process.env.R2_BUCKET_NAME ?? "atlas-assets";

// `LocalFilesystemStorageProvider` resolves this against `process.cwd()`, and
// the processes that touch local storage do not share one: the API dev server
// runs from backend/apps/api (`pnpm --filter`), this script runs from the repo
// root. With a relative value they write and read different directories, and
// the asset seeded here 500s when the app tries to serve it.
if (!path.isAbsolute(rawStorageRoot)) {
  console.warn(
    `[seed-fundedbeyond-branding] WARNING: STORAGE_LOCAL_ROOT="${rawStorageRoot}" is relative.\n` +
      `  This script will write to ${storageRoot}, but the API dev server resolves it against\n` +
      `  backend/apps/api and will not find the file. Set an absolute path in .env.local.`,
  );
}

/** Mirrors LocalFilesystemStorageProvider's on-disk layout. */
async function putObject(objectKey, body, contentType) {
  const filePath = path.join(storageRoot, bucket, objectKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  await writeFile(
    `${filePath}.meta.json`,
    JSON.stringify({
      contentType,
      sizeBytes: body.byteLength,
      checksumSha256: createHash("sha256").update(body).digest("hex"),
    }),
  );
}

async function main() {
  const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required (.env.local).");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: tenantRows } = await client.query(`select id from tenants where slug = $1`, [
      TENANT_SLUG,
    ]);
    const tenantId = tenantRows[0]?.id;
    if (!tenantId) throw new Error(`Tenant "${TENANT_SLUG}" not found. Provision it first.`);

    const svg = await readFile(SOURCE_LOGO);

    // `assertTenantKeyPrefix` requires the tenants/<id>/ prefix, and
    // `buildTenantStorageKey` puts branding logos under branding/logos/.
    const objectKey = `tenants/${tenantId}/branding/logos/${randomUUID()}-avatar-gradient.svg`;
    await putObject(objectKey, svg, "image/svg+xml");

    const referenceId = randomUUID();
    await client.query(
      `insert into storage_references (
         id, tenant_id, bucket, object_key, purpose, resource_type, resource_id,
         file_name, content_type, size_bytes, checksum_sha256, visibility, status,
         created_at, updated_at
       )
       values ($1::uuid, $2::uuid, $3, $4, 'branding.logo', 'tenant_branding', $2::uuid,
               'avatar-gradient.svg', 'image/svg+xml', $5, $6, 'public-safe', 'READY',
               now(), now())`,
      [
        referenceId,
        tenantId,
        bucket,
        objectKey,
        svg.byteLength,
        createHash("sha256").update(svg).digest("hex"),
      ],
    );

    // The mark is self-contained (gradient disc), so it works on light and dark
    // surfaces — the same reason the old shared constant used one asset.
    const { rowCount } = await client.query(
      `update tenant_branding
          set logo_light_ref_id = $2::uuid,
              logo_dark_ref_id  = $2::uuid,
              favicon_ref_id    = coalesce(favicon_ref_id, $2::uuid),
              status            = 'PUBLISHED',
              published_at      = coalesce(published_at, now()),
              version           = greatest(version, 1),
              updated_at        = now()
        where tenant_id = $1::uuid`,
      [tenantId, referenceId],
    );

    if (rowCount === 0) {
      throw new Error("No tenant_branding row for FundedBeyond — apply its manifest first.");
    }

    console.log(`[seed-fundedbeyond-branding] tenant ${tenantId}`);
    console.log(`  logo object : ${objectKey}`);
    console.log(`  reference   : ${referenceId}`);
    console.log(`  branding    : PUBLISHED (publicName now reaches the runtime projection)`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
