import { randomUUID } from "node:crypto";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { purgeExpiredIdempotencyRecords } from "@atlas/api/idempotency-registry";
import { purgeExpiredProctoringMedia } from "../server/proctoring/proctoring-media-retention";
import { purgeExpiredAttributionEvents } from "@atlas/domain/sales-marketing/attribution-retention";
import { getStorageProvider, parseStorageEnv } from "@atlas/storage";
import { OUTBOX_PROCESSORS, type OutboxProcessor } from "./outbox-processors";

export type SweepOptions = {
  /** Max events each processor drains per tenant per pass. */
  batchLimit: number;
  maxRetries: number;
  /** Set when shutdown has been requested; the sweep stops at the next boundary. */
  signal?: AbortSignal | undefined;
  processors?: readonly OutboxProcessor[] | undefined;
  listTenantIds?: (() => Promise<string[]>) | undefined;
  /**
   * Retention tasks, injectable for the same reason the processors are: a unit
   * test of sweep orchestration should not need a database and an object store
   * to assert that a failing processor is isolated from its neighbours.
   */
  retentionTasks?: readonly RetentionTask[] | undefined;
};

export type RetentionTask = {
  name: string;
  run: (input: { tenantId: string; requestId: string }) => Promise<number>;
};

export type SweepResult = {
  requestId: string;
  tenants: number;
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
  /** Processor/tenant pairs that threw. The sweep continues past them. */
  errors: Array<{ processor: string; tenantId: string; message: string }>;
  /** True when at least one processor filled its batch — more work is waiting. */
  saturated: boolean;
  durationMs: number;
  abortedEarly: boolean;
  /** Expired idempotency records deleted this sweep (M10 retention). */
  idempotencyRecordsPurged: number;
  /** Expired proctoring media artifacts deleted this sweep (M12 retention). */
  proctoringMediaPurged: number;
  /** Expired attribution events deleted this sweep. */
  attributionEventsPurged: number;
};

export async function listActiveTenantIds(): Promise<string[]> {
  const rows = await withGlobalDb(
    (db) => db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE state = 'ACTIVE' AND deleted_at IS NULL ORDER BY id
    `,
  );
  return rows.map((row) => row.id);
}

/**
 * One pass over every active tenant x every outbox consumer group.
 *
 * Failure isolation is the whole point of the try/catch: a single tenant with a
 * poison event, or one consumer group whose downstream is down, must not stop
 * the other nine groups or the other tenants from draining. Per-event failures
 * are already dead-lettered inside `processOutboxBatch`; this catches the
 * batch-level failures above it (connection loss, tenant transaction rejected).
 */
/**
 * The production retention tasks. Separated from `runOutboxSweep` so the sweep's
 * orchestration can be tested without a database or an object store.
 */
/**
 * Which result counter each retention task reports into.
 *
 * A lookup rather than an if/else chain: the previous form sent anything that
 * was not the idempotency purge into the proctoring counter, so adding a third
 * task would have silently inflated a number about webcam footage with a count
 * of marketing events.
 */
const RETENTION_COUNTERS: Record<
  string,
  "idempotencyRecordsPurged" | "proctoringMediaPurged" | "attributionEventsPurged"
> = {
  "idempotency-purge": "idempotencyRecordsPurged",
  "proctoring-media-purge": "proctoringMediaPurged",
  "attribution-events-purge": "attributionEventsPurged",
};

export function defaultRetentionTasks(): RetentionTask[] {
  return [
    {
      name: "idempotency-purge",
      run: async ({ tenantId, requestId }) =>
        withTenantTx({ tenantId, requestId, allowAnonymousTenantRead: true }, async (tx) =>
          purgeExpiredIdempotencyRecords(tx),
        ),
    },
    {
      name: "proctoring-media-purge",
      run: async ({ tenantId, requestId }) => {
        const storage = getStorageProvider();
        const bucket = parseStorageEnv(process.env).R2_BUCKET_NAME;
        const outcome = await withTenantTx(
          { tenantId, requestId, allowAnonymousTenantRead: true },
          async (tx) =>
            purgeExpiredProctoringMedia(tx, async (objectKey) => {
              await storage.deleteObject({ bucket, key: objectKey });
            }),
        );
        return outcome.deleted;
      },
    },
    {
      // A no-op for every tenant that has not opted in, which is the default.
      // The sweep runs for all tenants; deletion is only ever a tenant's own
      // choice.
      name: "attribution-events-purge",
      run: async ({ tenantId, requestId }) =>
        withTenantTx({ tenantId, requestId, allowAnonymousTenantRead: true }, async (tx) =>
          purgeExpiredAttributionEvents(tx),
        ),
    },
  ];
}

export async function runOutboxSweep(options: SweepOptions): Promise<SweepResult> {
  const startedAt = Date.now();
  const requestId = randomUUID();
  const processors = options.processors ?? OUTBOX_PROCESSORS;
  const listTenants = options.listTenantIds ?? listActiveTenantIds;

  const result: SweepResult = {
    requestId,
    tenants: 0,
    processed: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    saturated: false,
    durationMs: 0,
    abortedEarly: false,
    idempotencyRecordsPurged: 0,
    proctoringMediaPurged: 0,
    attributionEventsPurged: 0,
  };

  const tenantIds = await listTenants();
  result.tenants = tenantIds.length;

  for (const tenantId of tenantIds) {
    if (options.signal?.aborted) {
      result.abortedEarly = true;
      break;
    }

    for (const processor of processors) {
      if (options.signal?.aborted) {
        result.abortedEarly = true;
        break;
      }

      try {
        const batch = await processor.run({
          tenantId,
          requestId: `${requestId}:${processor.name}:${tenantId}`,
          limit: options.batchLimit,
          maxRetries: options.maxRetries,
        });

        result.processed += batch.processed;
        result.delivered += batch.delivered;
        result.failed += batch.failed;
        result.skipped += batch.skipped;

        if (batch.processed >= options.batchLimit) result.saturated = true;
      } catch (error) {
        result.errors.push({
          processor: processor.name,
          tenantId,
          message: error instanceof Error ? error.message.slice(0, 500) : String(error),
        });
      }
    }
  }

  // Retention. Both tasks visit every tenant, so they ride the sweep that is
  // already doing exactly that rather than adding scheduled jobs of their own.
  //
  //   M10 — idempotency records hold request fingerprints and response bodies,
  //         so keeping them past expiry is a privacy cost as well as a growing
  //         table.
  //   M12 — proctoring media is webcam and screen footage of learners sitting
  //         exams. The table had an expiry column and nothing that ever acted on
  //         it, and a retention policy with no deletion job is indistinguishable
  //         from no policy.
  const retentionTasks = options.retentionTasks ?? defaultRetentionTasks();

  for (const tenantId of tenantIds) {
    if (options.signal?.aborted) {
      result.abortedEarly = true;
      break;
    }

    for (const task of retentionTasks) {
      try {
        const purged = await task.run({
          tenantId,
          requestId: `${requestId}:${task.name}`,
        });
        const counter = RETENTION_COUNTERS[task.name];
        if (counter) result[counter] += purged;
      } catch (error) {
        result.errors.push({
          processor: task.name,
          tenantId,
          message: error instanceof Error ? error.message.slice(0, 500) : String(error),
        });
      }
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}
