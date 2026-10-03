import type { TenantTx } from "@atlas/db";

export type CleanupSource = "report_run" | "export_job";
export type CleanupRequest = {
  id: string;
  tenant_id: string;
  source_type: CleanupSource;
  source_id: string;
  object_key: string;
  artifact_json: unknown;
  lease_token: string;
};

/** Expiry doubles as immediate download revocation; keys remain until verified deletion. */
export async function enqueueExportCleanup(
  tx: TenantTx,
  input: {
    cutoff?: Date;
    sourceType?: CleanupSource;
    sourceId?: string;
    includeLegacyReports?: boolean;
  } = {},
): Promise<number> {
  let count = 0;
  if (!input.sourceType || input.sourceType === "report_run") {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      with selected as (
        update report_runs set expires_at = least(coalesce(expires_at, now()), now()), updated_at = now()
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and r2_object_key is not null and status in ('SUCCEEDED', 'FAILED', 'CANCELLED')
          and (file_retention_managed or ${Boolean(input.includeLegacyReports || input.sourceId || input.cutoff)})
          and (${input.sourceId ?? null}::uuid is null or id = ${input.sourceId ?? null}::uuid)
          and (${Boolean(input.sourceId)} or
            (${input.cutoff ?? null}::timestamptz is not null and coalesce(completed_at, created_at) < ${input.cutoff ?? null}::timestamptz) or
            (${input.cutoff ?? null}::timestamptz is null and expires_at <= now()))
        returning id, tenant_id, r2_object_key, artifact_json
      ), queued as (
        insert into export_file_cleanup_requests (tenant_id, source_type, source_id, object_key, artifact_json)
        select tenant_id, 'report_run', id, r2_object_key, artifact_json from selected
        on conflict (tenant_id, source_type, source_id, object_key) do nothing returning id
      ) select count(*)::int as count from selected
    `;
    count += rows[0]?.count ?? 0;
  }
  if (!input.sourceType || input.sourceType === "export_job") {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      with selected as (
        update export_jobs set expires_at = least(coalesce(expires_at, now()), now()), updated_at = now()
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and r2_object_key is not null and status in ('SUCCEEDED', 'FAILED', 'CANCELLED')
          and (status <> 'CANCELLED' or artifact_json->>'writerStoppedAt' is not null)
          and (${input.sourceId ?? null}::uuid is null or id = ${input.sourceId ?? null}::uuid)
          and (${Boolean(input.sourceId)} or
            (${input.cutoff ?? null}::timestamptz is not null and coalesce((artifact_json->>'retentionStartedAt')::timestamptz, created_at) < ${input.cutoff ?? null}::timestamptz) or
            (${input.cutoff ?? null}::timestamptz is null and expires_at <= now()))
        returning id, tenant_id, r2_object_key, artifact_json
      ), queued as (
        insert into export_file_cleanup_requests (tenant_id, source_type, source_id, object_key, artifact_json)
        select tenant_id, 'export_job', id, r2_object_key, artifact_json from selected
        on conflict (tenant_id, source_type, source_id, object_key) do nothing returning id
      ) select count(*)::int as count from selected
    `;
    count += rows[0]?.count ?? 0;
  }
  return count;
}

export const exportFileCleanupRepository = {
  async claim(tx: TenantTx, leaseToken: string, limit: number): Promise<CleanupRequest[]> {
    return tx.$queryRaw<CleanupRequest[]>`
      with candidates as (
        select id from export_file_cleanup_requests
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and status <> 'succeeded' and (lease_until is null or lease_until < now())
        order by updated_at, id limit ${limit} for update skip locked
      ) update export_file_cleanup_requests q
        set status = 'processing', lease_token = ${leaseToken}::uuid,
          lease_until = now() + interval '5 minutes', attempts = attempts + 1, updated_at = now()
        from candidates where q.id = candidates.id returning q.*
    `;
  },

  async complete(tx: TenantTx, request: CleanupRequest): Promise<boolean> {
    // Lock the queue lease before touching the source. A stale worker cannot
    // erase a new source reference or acknowledge a newer cleanup attempt.
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      select id from export_file_cleanup_requests
      where id = ${request.id}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = 'processing' and lease_token = ${request.lease_token}::uuid for update
    `;
    if (!owned.length) return false;
    const changed =
      request.source_type === "report_run"
        ? await tx.$executeRaw`
          update report_runs set r2_object_key = null, artifact_json = null, updated_at = now()
          where id = ${request.source_id}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
            and r2_object_key = ${request.object_key} and status in ('SUCCEEDED', 'FAILED', 'CANCELLED')
        `
        : await tx.$executeRaw`
          update export_jobs set r2_object_key = null, artifact_json = null, updated_at = now()
          where id = ${request.source_id}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
            and r2_object_key = ${request.object_key} and status in ('SUCCEEDED', 'FAILED', 'CANCELLED')
            and (status <> 'CANCELLED' or artifact_json->>'writerStoppedAt' is not null)
        `;
    if (changed !== 1) throw new Error("Export cleanup source changed; reconciliation required.");
    await tx.$executeRaw`
      update export_file_cleanup_requests set status = 'succeeded', lease_token = null,
        lease_until = null, last_error = null, updated_at = now() where id = ${request.id}::uuid
    `;
    return true;
  },

  async fail(tx: TenantTx, request: CleanupRequest): Promise<void> {
    await tx.$executeRaw`
      update export_file_cleanup_requests set status = 'pending', lease_token = null,
        lease_until = now() + interval '1 minute', last_error = 'Deletion not confirmed; retry required', updated_at = now()
      where id = ${request.id}::uuid and lease_token = ${request.lease_token}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
  },
};
