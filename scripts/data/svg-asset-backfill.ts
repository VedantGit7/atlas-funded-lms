import { createHash } from "node:crypto";
import { contentDispositionFor } from "../../backend/packages/storage/src/content-disposition";
import type { StorageProvider } from "../../backend/packages/storage/src/providers/storage-provider";
import { sanitizeSvg } from "../../backend/packages/storage/src/svg-sanitize";
import { connectWithCompleteVisibility, tenantScope } from "./backfill-connection";

/**
 * The audit M8 backfill: sanitize SVG uploads stored before uploads were
 * sanitized at confirm time. `scripts/data/sanitize-stored-svg-assets.ts` is
 * the command; this is the work, so it can be tested against Postgres and a
 * real storage provider.
 *
 * What makes it safe to point at production:
 *
 * - **It sees every reference or refuses** (see `backfill-connection.ts`):
 *   `storage_references` forces row-level security, and an owner without
 *   BYPASSRLS would see no SVGs and report nothing to do.
 * - **It covers deleted references too.** Deleting a reference does not delete
 *   its object, and the bytes are what can be fetched; a `DELETED` SVG whose
 *   object is gone is simply skipped.
 * - **Object and record change together.** Each SVG is handled in its own
 *   transaction holding the reference's row lock: the object is rewritten
 *   (sanitized, served as a download) and its size and checksum recorded
 *   before the lock is released. A reference that changed since it was read
 *   is skipped, never overwritten.
 * - **It repairs its own interruptions.** If a run stopped between writing an
 *   object and recording it, the next run finds a sanitized object whose
 *   recorded checksum is stale and corrects the record.
 *
 * It never prints file contents; references are named by id.
 */

type Row = {
  id: string;
  status: string;
  bucket: string;
  object_key: string;
  file_name: string;
  size_bytes: string;
  checksum_sha256: string | null;
};

export type SvgBackfillReport = {
  database: string;
  apply: boolean;
  /** SVG references examined (READY and DELETED). */
  scanned: number;
  /** Already sanitized, served as a download, and recorded correctly. */
  alreadySafe: number;
  /** References whose object must be rewritten. */
  toSanitize: string[];
  /** References whose object is already safe but whose size/checksum record is stale. */
  toCorrect: string[];
  sanitized: number;
  corrected: number;
  /** Changed by someone else since they were read; left alone, re-run to pick them up. */
  changedMeanwhile: string[];
  /** Failed and rolled back (object and record unchanged). */
  failed: string[];
  /** READY references whose object is missing from storage: need review. */
  missing: string[];
  /** Objects DOMPurify cannot parse as SVG: need review. */
  unreadable: string[];
  /** DELETED references whose object is already gone: nothing to do. */
  deletedGone: number;
  /** References still needing work after this run. */
  remaining: number;
};

const sha256 = (body: Buffer) => createHash("sha256").update(body).digest("hex");

export async function backfillStoredSvgAssets(options: {
  databaseUrl: string | undefined;
  apply: boolean;
  provider: StorageProvider;
  tenantIds?: readonly string[];
}): Promise<SvgBackfillReport> {
  const scope = tenantScope(options.tenantIds);
  const { client, database } = await connectWithCompleteVisibility(
    options.databaseUrl,
    "storage_references",
  );
  const report: SvgBackfillReport = {
    database,
    apply: options.apply,
    scanned: 0,
    alreadySafe: 0,
    toSanitize: [],
    toCorrect: [],
    sanitized: 0,
    corrected: 0,
    changedMeanwhile: [],
    failed: [],
    missing: [],
    unreadable: [],
    deletedGone: 0,
    remaining: 0,
  };

  try {
    const { rows } = await client.query<Row>(
      `select id::text, status, bucket, object_key, file_name, size_bytes::text, checksum_sha256
         from storage_references
        where lower(content_type) = 'image/svg+xml' and status in ('READY', 'DELETED')
          ${scope.sql(1)}
        order by id`,
      scope.params,
    );
    report.scanned = rows.length;

    for (const row of rows) {
      const location = { bucket: row.bucket, key: row.object_key };
      const [body, meta] = await Promise.all([
        options.provider.getObjectBody(location),
        options.provider.headObject(location),
      ]);
      if (!body) {
        if (row.status === "READY") report.missing.push(row.id);
        else report.deletedGone += 1;
        continue;
      }

      let sanitized: Buffer;
      try {
        sanitized = await sanitizeSvg(body);
      } catch {
        report.unreadable.push(row.id);
        continue;
      }
      const disposition = contentDispositionFor("image/svg+xml", row.file_name);
      const rewrite = !sanitized.equals(body) || meta?.contentDisposition !== disposition;
      const checksum = sha256(sanitized);
      const recordStale =
        row.checksum_sha256 !== checksum || row.size_bytes !== String(sanitized.byteLength);
      if (!rewrite && !recordStale) {
        report.alreadySafe += 1;
        continue;
      }
      (rewrite ? report.toSanitize : report.toCorrect).push(row.id);
      if (!options.apply) continue;

      await client.query("begin");
      try {
        const current = (
          await client.query<Pick<Row, "status" | "checksum_sha256">>(
            `select status, checksum_sha256 from storage_references where id = $1::uuid for update`,
            [row.id],
          )
        ).rows[0];
        if (
          !current ||
          current.status !== row.status ||
          current.checksum_sha256 !== row.checksum_sha256
        ) {
          await client.query("rollback");
          report.changedMeanwhile.push(row.id);
          continue;
        }
        if (rewrite) {
          await options.provider.putObject({
            ...location,
            body: sanitized,
            contentType: "image/svg+xml",
            contentDisposition: disposition,
          });
        }
        await client.query(
          `update storage_references
              set size_bytes = $2, checksum_sha256 = $3, updated_at = now()
            where id = $1::uuid`,
          [row.id, sanitized.byteLength, checksum],
        );
        await client.query("commit");
        if (rewrite) report.sanitized += 1;
        else report.corrected += 1;
      } catch {
        await client.query("rollback");
        report.failed.push(row.id);
      }
    }

    report.remaining =
      report.toSanitize.length +
      report.toCorrect.length -
      (options.apply ? report.sanitized + report.corrected : 0);
    return report;
  } finally {
    await client.end();
  }
}
