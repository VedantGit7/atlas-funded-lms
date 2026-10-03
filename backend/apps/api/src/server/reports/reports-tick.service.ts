import { randomUUID } from "node:crypto";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { reportsRepository } from "@atlas/domain/reports/reports.repository";
import { tickReportSchedules } from "@atlas/domain/reports/reports.service";
import { processReportsOutboxBatch } from "../../server/reports/reports-worker-router";

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

/** How often the outbox worker checks each tenant for due report schedules. */
export const REPORT_SCHEDULE_TICK_INTERVAL_MS = 60_000;

/** Last check per tenant in this process; the worker sweeps every few seconds. */
const lastScheduleTickAt = new Map<string, number>();

/**
 * Enqueues one tenant's due report schedules. Called by the outbox worker on every sweep; it
 * checks each tenant at most once per REPORT_SCHEDULE_TICK_INTERVAL_MS, and only runs the full
 * tick (which also upserts the tenant's system report definitions) when a schedule is due.
 *
 * Moved from a Vercel cron every 15 minutes, which the Hobby plan rejects. The worker already
 * drains the resulting report.generate_requested events through its `reports` processor, so
 * this only claims schedules. Several worker instances may run it at once: due schedules are
 * claimed with `for update skip locked`, so none is enqueued twice.
 *
 * Returns the number of report runs enqueued.
 */
export async function tickDueReportSchedulesForTenant(args: {
  tenantId: string;
  requestId: string;
  nowMs?: number;
}): Promise<number> {
  const now = args.nowMs ?? Date.now();
  const last = lastScheduleTickAt.get(args.tenantId);
  if (last !== undefined && now - last < REPORT_SCHEDULE_TICK_INTERVAL_MS) return 0;
  lastScheduleTickAt.set(args.tenantId, now);

  return await withTenantTx(
    { tenantId: args.tenantId, requestId: args.requestId, allowAnonymousTenantRead: true },
    async (tx) => {
      if (!(await reportsRepository.hasDueSchedules(tx, { asOf: new Date(now) }))) return 0;

      const actorMembershipId = await resolveScheduleTickActorMembershipId(tx);
      if (!actorMembershipId) return 0;

      const result = await tickReportSchedules(tx, {
        tenantId: args.tenantId,
        actorMembershipId,
        requestId: args.requestId,
      });
      return result.data.runsEnqueued;
    },
  );
}

/** Test seam: forget the per-tenant check times. */
export function resetReportScheduleTickClock(): void {
  lastScheduleTickAt.clear();
}

/**
 * Fan-out report schedule ticks across all active tenants, then drain any
 * queued report.generate_requested outbox events for those tenants.
 *
 * Kept for manual runs through the CRON_SECRET-protected internal endpoint; the scheduled
 * path is now the outbox worker (see tickDueReportSchedulesForTenant).
 */
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
