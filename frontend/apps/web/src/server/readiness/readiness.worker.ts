import { withTenantTx } from "@atlas/db";
import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";
import { competencyScoreChangedPayloadSchema } from "./readiness.schemas";
import { projectReadinessAfterScoreChanged } from "./readiness-evaluator.service";

export const READINESS_WORKER_DESTINATION = "readiness.projection";

export async function handleReadinessOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Readiness worker requires tenant-scoped events.");
  }

  if (event.eventType !== "competency.score_changed") {
    return;
  }

  const payload = competencyScoreChangedPayloadSchema.parse(event.payload);
  const tenantId = event.tenantId;

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await projectReadinessAfterScoreChanged({
        tx,
        ctx: {
          tenantId,
          requestId: event.requestId,
        },
        payload,
      });
    },
  );
}

export const readinessOutboxHandlers = [
  {
    destinationKey: READINESS_WORKER_DESTINATION,
    handle: handleReadinessOutboxEvent,
  },
];

export function createReadinessOutboxConsumers() {
  return {
    "competency.score_changed": readinessOutboxHandlers,
  };
}

export async function processReadinessOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  return withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      processOutboxBatch(tx, {
        limit: args.limit ?? 25,
        maxRetries: args.maxRetries ?? 3,
        handlers: createReadinessOutboxConsumers(),
      }),
  );
}
