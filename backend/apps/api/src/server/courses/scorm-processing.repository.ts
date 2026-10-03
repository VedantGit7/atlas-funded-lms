import type { TenantTx } from "@atlas/db";

export type ScormWork = { tenantId: string; moduleId: string; assetReferenceId: string };
export type ScormSource = { bucket: string; object_key: string; size_bytes: bigint | number };

export async function loadScormProcessingSource(tx: TenantTx, input: ScormWork) {
  const rows = await tx.$queryRaw<ScormSource[]>`
    SELECT s.bucket, s.object_key, s.size_bytes
    FROM course_modules m JOIN storage_references s
      ON s.id=m.scorm_package_reference_id AND s.tenant_id=m.tenant_id
    WHERE m.id=${input.moduleId}::uuid AND m.tenant_id=${input.tenantId}::uuid
      AND m.scorm_package_reference_id=${input.assetReferenceId}::uuid
      AND m.deleted_at IS NULL AND s.deleted_at IS NULL AND s.status='READY'
      AND s.purpose='module.scorm' AND s.resource_id=m.id
  `;
  return rows[0] ?? null;
}

export type ScormCompletion = ScormWork & {
  eventId: string;
  attempt: number;
  contentVersion: string;
  launchPath: string;
  scormVersion: string;
};
export async function completeScormProcessing(tx: TenantTx, input: ScormCompletion) {
  // Match the outbox lock order: claim first, then business rows. Hold the
  // claim lock until publication commits so another attempt cannot supersede
  // the lease between its validation and the module update. Validate in the
  // following statement, using current wall time after any lock wait.
  const jobs = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM outbox_delivery_jobs
    WHERE outbox_event_id=${input.eventId}::uuid AND tenant_id=${input.tenantId}::uuid
      AND destination_key='scorm.package.process'
    FOR UPDATE
  `;
  if (!jobs.length) return;
  const modules = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM course_modules
    WHERE id=${input.moduleId}::uuid AND tenant_id=${input.tenantId}::uuid
      AND scorm_package_reference_id=${input.assetReferenceId}::uuid AND deleted_at IS NULL
    FOR UPDATE
  `;
  if (!modules.length) return;
  // A replaced asset or lost delivery lease cannot publish stale content. Each attempt writes
  // its own object prefix, so an expired worker cannot alter the winner's visible files.
  await tx.$executeRaw`
    UPDATE course_modules SET scorm_launch_path=${input.launchPath},
      scorm_version=${input.scormVersion}, scorm_content_version=${input.contentVersion}::uuid,
      updated_at=now()
    WHERE id=${input.moduleId}::uuid AND tenant_id=${input.tenantId}::uuid
      AND scorm_package_reference_id=${input.assetReferenceId}::uuid AND deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM outbox_delivery_jobs j
        WHERE j.outbox_event_id=${input.eventId}::uuid AND j.tenant_id=${input.tenantId}::uuid
          AND j.destination_key='scorm.package.process' AND j.status='processing'
          AND j.attempt_count=${input.attempt} AND j.lease_until>clock_timestamp())
  `;
}
