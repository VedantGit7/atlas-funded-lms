import type { TenantTx } from "@atlas/db";

/**
 * Retention for proctoring media (audit finding M12).
 *
 * `ProctoringMediaArtifact` accumulated indefinitely: no retention logic existed
 * anywhere under `server/proctoring/`. The cost is permanent storage; the real
 * exposure is that the artifacts are webcam and screen recordings of learners
 * sitting exams, which carries regulatory weight that a storage bill does not.
 *
 * Two halves, and both are needed:
 *
 *   - every artifact is written with an expiry (the column is NOT NULL with a
 *     90-day default, so omission fails safe rather than silently forever), and
 *   - a sweep actually deletes the object and the row once that passes.
 *
 * A retention *policy* without a deletion *job* is what the audit found, and it
 * is indistinguishable from having no policy at all.
 */

/** Applied when a tenant expresses no preference. */
export const DEFAULT_MEDIA_RETENTION_DAYS = 90;

/**
 * Ceiling on what a tenant may choose.
 *
 * Tenants can shorten retention freely — that only reduces exposure. Extending
 * it is capped, because "keep exam footage for ten years" is a decision with
 * regulatory consequences that a per-tenant settings field should not be able
 * to make unilaterally.
 */
export const MAX_MEDIA_RETENTION_DAYS = 365;

export const MIN_MEDIA_RETENTION_DAYS = 1;

export function clampRetentionDays(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MEDIA_RETENTION_DAYS;
  }
  const rounded = Math.floor(value);
  if (rounded < MIN_MEDIA_RETENTION_DAYS) return MIN_MEDIA_RETENTION_DAYS;
  if (rounded > MAX_MEDIA_RETENTION_DAYS) return MAX_MEDIA_RETENTION_DAYS;
  return rounded;
}

/**
 * The tenant's configured window, from the exam security policy that already
 * governs proctoring behaviour, rather than a new settings surface.
 */
export async function resolveMediaRetentionDays(tx: TenantTx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ days: number | null }>>`
    -- Cast to int, not numeric: Prisma maps numeric to a string at runtime, so
    -- the declared number type would have been a lie and the value would have
    -- fallen through to the default instead of being honoured.
    SELECT floor((config_json ->> 'mediaRetentionDays')::numeric)::int AS days
      FROM exam_security_policies
     WHERE config_json ? 'mediaRetentionDays'
     ORDER BY updated_at DESC
     LIMIT 1
  `;

  // The int cast above means this really is a number at runtime, so a null
  // check is all that is needed.
  const days = rows[0]?.days;
  return clampRetentionDays(days ?? undefined);
}

export type ProctoringMediaArtifactInput = {
  tenantId: string;
  proctoringSessionId: string;
  proctoringEventId?: string | null;
  kind: string;
  objectKey: string;
  contentType: string;
  metadata?: Record<string, unknown>;
};

/**
 * The only supported way to record an artifact.
 *
 * The expiry is computed here rather than left to the caller so that an upload
 * path cannot create an artifact that outlives the policy — the column default
 * is the backstop, this is the intent.
 */
export async function insertProctoringMediaArtifact(
  tx: TenantTx,
  input: ProctoringMediaArtifactInput,
): Promise<{ id: string; retentionExpiresAt: Date }> {
  const retentionDays = await resolveMediaRetentionDays(tx);

  const rows = await tx.$queryRaw<Array<{ id: string; retention_expires_at: Date }>>`
    INSERT INTO proctoring_media_artifacts (
      id, tenant_id, proctoring_session_id, proctoring_event_id,
      kind, r2_object_key, content_type, metadata_json, retention_expires_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.tenantId}::uuid,
      ${input.proctoringSessionId}::uuid,
      ${input.proctoringEventId ?? null}::uuid,
      ${input.kind},
      ${input.objectKey},
      ${input.contentType},
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      now() + make_interval(days => ${retentionDays}::int)
    )
    RETURNING id::text, retention_expires_at
  `;

  const row = rows[0];
  if (!row) throw new Error("PROCTORING_MEDIA_ARTIFACT_INSERT_FAILED");
  return { id: row.id, retentionExpiresAt: row.retention_expires_at };
}

export type ExpiredArtifact = { id: string; objectKey: string };

export async function listExpiredProctoringMedia(
  tx: TenantTx,
  limit: number,
): Promise<ExpiredArtifact[]> {
  const rows = await tx.$queryRaw<Array<{ id: string; r2_object_key: string }>>`
    SELECT id::text, r2_object_key
      FROM proctoring_media_artifacts
     WHERE retention_expires_at < now()
     ORDER BY retention_expires_at ASC
     LIMIT ${limit}
  `;
  return rows.map((row) => ({ id: row.id, objectKey: row.r2_object_key }));
}

export async function deleteProctoringMediaRows(tx: TenantTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return tx.$executeRaw`
    DELETE FROM proctoring_media_artifacts
     WHERE id = ANY(${ids}::uuid[])
  `;
}

/**
 * Deletes expired artifacts, object first.
 *
 * Order matters and the failure mode is deliberate: the stored object goes
 * before the row that points at it, so an interruption leaves a row whose object
 * is already gone — recoverable, and it will be retried. The other order would
 * leave an orphaned recording in object storage with nothing referencing it,
 * which is the outcome this finding is about.
 */
export async function purgeExpiredProctoringMedia(
  tx: TenantTx,
  deleteObject: (objectKey: string) => Promise<void>,
  limit = 200,
): Promise<{ deleted: number; failed: number }> {
  const expired = await listExpiredProctoringMedia(tx, limit);
  const deletable: string[] = [];
  let failed = 0;

  for (const artifact of expired) {
    try {
      await deleteObject(artifact.objectKey);
      deletable.push(artifact.id);
    } catch {
      // Leave the row so the next sweep retries. Dropping it here would strand
      // the object permanently.
      failed += 1;
    }
  }

  const deleted = await deleteProctoringMediaRows(tx, deletable);
  return { deleted, failed };
}
