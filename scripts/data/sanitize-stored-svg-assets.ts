/**
 * Sanitizes SVG uploads stored before audit M8.
 *
 *   DIRECT_DATABASE_URL=... <storage env> pnpm data:sanitize-svg-assets
 *   ... pnpm data:sanitize-svg-assets -- --apply
 *
 * Uploads are now sanitized when they are confirmed, but an SVG confirmed
 * earlier (a lesson thumbnail; branding uploads were never confirmed) was
 * stored as uploaded, and public-safe objects can be fetched straight from the
 * bucket. This rewrites each READY SVG with its sanitized form and a download
 * disposition, and records the new size and checksum.
 *
 * Dry run by default: it reports which objects would change. It is safe to
 * re-run: an object already sanitized and stored as a download is left alone,
 * and a reference is only updated if its checksum is still the one it read. It
 * needs the database owner connection (DIRECT_DATABASE_URL) because it works
 * across tenants, and the same storage settings as the API.
 */
import { createHash } from "node:crypto";
import { Client } from "pg";
import { contentDispositionFor } from "../../backend/packages/storage/src/content-disposition";
import { createStorageProvider } from "../../backend/packages/storage/src/providers/storage-provider-factory";
import { parseStorageEnv } from "../../backend/packages/storage/src/schemas/storage-env";
import { sanitizeSvg } from "../../backend/packages/storage/src/svg-sanitize";

type Row = {
  id: string;
  bucket: string;
  object_key: string;
  file_name: string;
  checksum_sha256: string | null;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env["DIRECT_DATABASE_URL"];
  if (!url) throw new Error("DIRECT_DATABASE_URL (database owner) is required.");
  const provider = createStorageProvider(parseStorageEnv(process.env));

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<Row>(
      `select id::text, bucket, object_key, file_name, checksum_sha256
         from storage_references
        where status = 'READY' and lower(content_type) = 'image/svg+xml'`,
    );

    let pending = 0;
    let rewritten = 0;
    const unreadable: string[] = [];
    for (const row of rows) {
      const location = { bucket: row.bucket, key: row.object_key };
      const [body, meta] = await Promise.all([
        provider.getObjectBody(location),
        provider.headObject(location),
      ]);
      if (!body) {
        unreadable.push(`${row.id} (object missing)`);
        continue;
      }
      let sanitized: Buffer;
      try {
        sanitized = await sanitizeSvg(body);
      } catch {
        unreadable.push(`${row.id} (not a readable SVG)`);
        continue;
      }
      const disposition = contentDispositionFor("image/svg+xml", row.file_name);
      if (sanitized.equals(body) && meta?.contentDisposition === disposition) continue;

      pending += 1;
      if (!apply) continue;
      await provider.putObject({
        ...location,
        body: sanitized,
        contentType: "image/svg+xml",
        contentDisposition: disposition,
      });
      const result = await client.query(
        `update storage_references
            set size_bytes = $2, checksum_sha256 = $3, updated_at = now()
          where id = $1::uuid and checksum_sha256 is not distinct from $4`,
        [
          row.id,
          sanitized.byteLength,
          createHash("sha256").update(sanitized).digest("hex"),
          row.checksum_sha256,
        ],
      );
      rewritten += result.rowCount ?? 0;
    }

    console.log(`${String(rows.length)} READY SVG asset(s); ${String(pending)} need sanitizing.`);
    for (const entry of unreadable) console.log(`Not processed: ${entry}`);
    if (!apply) {
      if (pending > 0) console.log("Dry run. Re-run with --apply to sanitize them.");
      return;
    }
    console.log(`Sanitized ${String(rewritten)} of ${String(pending)}.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
