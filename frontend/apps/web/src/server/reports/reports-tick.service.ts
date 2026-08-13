import { randomUUID } from "node:crypto";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { tickReportSchedules } from "@atlas/domain/reports/reports.service";
import { processReportsOutboxBatch } from "./reports-worker-router";

/**
 * Resolve a real membership to satisfy ServiceCtx for the tick call.
 * Enqueued runs and outbox events still attribute to each schedule's
 * created_by_membership_id inside tickReportSchedules.
 */
async function resolveScheduleTickActorMembershipId(
  tx: Parameters<Parameters<typeof withTenantTx>[1]>[0],
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    select id::text as id
    from memberships
    where status = 'ACTIVE'
    order by created_at asc
    limit 1
  `;
  return rows[0]?.id ?? null;
}

export async function tickReportSchedulesForActiveTenants(
  requestId: string,
): Promise<{ tenants: number; claimed: number; drained: number }> {
  const tenants = await withGlobalDb(
    (db) =>
      db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE state = 'ACTIVE' AND deleted_at IS NULL
    `,
  );

  let claimed = 0;
  let drained = 0;

  for (const tenant of tenants) {
    const tickResult = await withTenantTx(
      { tenantId: tenant.id, requestId, allowAnonymousTenantRead: true },
      async (tx) => {
        const actorMembershipId = await resolveScheduleTickActorMembershipId(tx);
        if (!actorMembershipId) {
          return {
            data: { tenantsProcessed: 1, schedulesClaimed: 0, runsEnqueued: 0 },
          };
        }
        return tickReportSchedules(tx, {
          tenantId: tenant.id,
          // Context actor for the batch call; per-schedule owner is used for
          // report_run.requested_by and outbox actorMembershipId.
          actorMembershipId,
          requestId,
        });
      },
    );
    claimed += tickResult.data.schedulesClaimed;

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
