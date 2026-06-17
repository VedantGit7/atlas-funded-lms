import type { PlatformTx } from "@atlas/db";
import type { ProvisioningJobRow } from "./platform-tenant.types";

export async function insertProvisioningJob(
  tx: PlatformTx,
  input: {
    tenantId: string;
    idempotencyKey: string;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    step: string;
  },
): Promise<{ id: string }> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO provisioning_jobs (
      id,
      tenant_id,
      idempotency_key,
      status,
      step_key,
      request_json,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.tenantId},
      ${input.idempotencyKey},
      ${input.status}::"JobStatus",
      ${input.step},
      '{}'::jsonb,
      now(),
      now()
    )
    RETURNING id
  `;

  const row = rows[0];
  if (row === undefined) {
    throw new Error("Expected provisioning job insert to return id");
  }

  return row;
}

export async function findTenantIdByProvisioningIdempotencyKey(
  tx: PlatformTx,
  idempotencyKey: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id::text
    FROM provisioning_jobs
    WHERE idempotency_key = ${idempotencyKey}
      AND status = 'SUCCEEDED'::"JobStatus"
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return rows[0]?.tenant_id ?? null;
}

export async function updateProvisioningJobStatus(
  tx: PlatformTx,
  input: {
    jobId: string;
    status: "RUNNING" | "SUCCEEDED" | "FAILED";
    step: string;
    errorCode?: string | null;
    safeErrorMessage?: string | null;
  },
): Promise<void> {
  const errorJson =
    input.errorCode != null || input.safeErrorMessage != null
      ? {
          code: input.errorCode ?? null,
          message: input.safeErrorMessage ?? null,
        }
      : null;

  const errorJsonLiteral = errorJson != null ? JSON.stringify(errorJson) : null;

  await tx.$executeRaw`
    UPDATE provisioning_jobs
    SET status = ${input.status}::"JobStatus",
        step_key = ${input.step},
        error_json = ${errorJsonLiteral}::jsonb,
        updated_at = now()
    WHERE id = ${input.jobId}
  `;
}

export async function listProvisioningJobsForTenant(
  tx: PlatformTx,
  tenantId: string,
): Promise<ProvisioningJobRow[]> {
  return tx.$queryRaw<ProvisioningJobRow[]>`
    SELECT
      id,
      tenant_id,
      status,
      step_key AS step,
      error_json,
      idempotency_key,
      created_at,
      updated_at
    FROM provisioning_jobs
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `;
}
