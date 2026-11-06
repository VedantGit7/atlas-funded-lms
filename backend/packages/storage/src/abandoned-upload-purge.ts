import type { TenantTx } from "@atlas/db";
import {
  listAbandonedPendingUploads,
  markAbandonedUploadsDeleted,
} from "./asset-reference.repository";

/**
 * How long an unconfirmed upload is kept. A signed upload URL lasts at most 15
 * minutes (`STORAGE_SIGNED_UPLOAD_TTL_SECONDS`), so an upload still pending a
 * day later never will be confirmed.
 */
export const ABANDONED_UPLOAD_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Removes uploads that were signed but never confirmed: the object, if the
 * browser sent one before giving up, then the reference. Nothing swept these
 * before, so each abandoned upload kept a pending reference, and any bytes it
 * had sent stayed in the bucket (launch plan 5.1, staging, 6 November 2026).
 *
 * A reference whose object can't be deleted stays pending for the next sweep;
 * deleting a key that was never written succeeds.
 */
export async function purgeAbandonedUploads(
  tx: TenantTx,
  deleteObject: (object: { bucket: string; key: string }) => Promise<void>,
  options: { now?: Date; limit?: number } = {},
): Promise<{ deleted: number; failed: number }> {
  const before = new Date((options.now ?? new Date()).getTime() - ABANDONED_UPLOAD_AFTER_MS);
  const abandoned = await listAbandonedPendingUploads(tx, { before, limit: options.limit ?? 200 });

  const gone: string[] = [];
  let failed = 0;
  for (const upload of abandoned) {
    try {
      await deleteObject({ bucket: upload.bucket, key: upload.object_key });
      gone.push(upload.id);
    } catch {
      failed += 1;
    }
  }

  const deleted = await markAbandonedUploadsDeleted(tx, gone);
  return { deleted, failed };
}
