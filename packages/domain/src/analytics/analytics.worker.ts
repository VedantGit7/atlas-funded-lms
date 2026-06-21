import { withTenantTx } from "@atlas/db";
import { applyAnalyticsProjectionMutations } from "./analytics-projection-writer";
import { getAnalyticsAdaptersForEvent } from "./analytics-source-registry";
import type { AnalyticsServiceCtx } from "./analytics.types";

export const ANALYTICS_WORKER_DESTINATION = "analytics.projections";

export async function processAnalyticsSourceEvent(
  tx: Parameters<typeof applyAnalyticsProjectionMutations>[0],
  ctx: AnalyticsServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  const adapters = getAnalyticsAdaptersForEvent(event.eventType);
  if (adapters.length === 0) {
    return;
  }

  const mutations = [];
  for (const adapter of adapters) {
    const next = await adapter.buildMutations(tx, ctx, event);
    mutations.push(...next);
  }

  if (mutations.length === 0) {
    return;
  }

  await applyAnalyticsProjectionMutations(tx, mutations);
}

export async function handleAnalyticsOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Analytics worker requires tenant-scoped events.");
  }

  const tenantId = event.tenantId;

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await processAnalyticsSourceEvent(
        tx,
        {
          tenantId,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId: event.requestId,
        },
        event,
      );
    },
  );
}

export const analyticsOutboxHandlers = [
  {
    destinationKey: ANALYTICS_WORKER_DESTINATION,
    handle: handleAnalyticsOutboxEvent,
  },
];

export const DEFERRED_ANALYTICS_EVENT_PREFIXES = [
  "challenge.",
  "payment.",
  "order.",
  "subscription.",
  "invoice.",
  "pnl.",
  "profit.",
  "trade.",
  "broker.",
  "funded.",
] as const;

export function isDeferredAnalyticsEvent(eventType: string): boolean {
  return DEFERRED_ANALYTICS_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}
