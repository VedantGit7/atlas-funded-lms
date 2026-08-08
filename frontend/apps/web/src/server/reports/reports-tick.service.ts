import { randomUUID } from "node:crypto";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { tickReportSchedules } from "@atlas/domain/reports/reports.service";
import { processReportsOutboxBatch } from "./reports-worker-router";

export async function tickReportSchedulesForActiveTenants(
  requestId: string,
): Promise<{ tenants: number; claimed: number; drained: number }> {
  const tenants = await withGlobalDb((db) =>
    db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE state = 'ACTIVE' AND deleted_at IS NULL
    `,
  );

  let claimed = 0;
  let drained = 0;

  for (const tenant of tenants) {
    const tickResult = await withTenantTx(
      { tenantId: tenant.id, requestId, allowAnonymousTenantRead: true },
      async (tx) =>
        tickReportSchedules(tx, {
          tenantId: tenant.id,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId,
        }),
    );
    claimed += tickResult.data.claimed;

    const drainResult = await processReportsOutboxBatch({
      tenantId: tenant.id,
      requestId: `${requestId}:${tenant.id}`,
      limit: 25,
    });
    drained += drainResult.processed;
  }

  return { tenants: tenants.length, claimed, drained };
}

export function createReportsTickRequestId(): string {
  return randomUUID();
}
