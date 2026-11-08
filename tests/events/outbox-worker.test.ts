import { beforeEach, describe, it, expect, vi } from "vitest";
import type { EventsDbTx } from "@atlas/events/transaction";
const mocks = vi.hoisted(() => ({
  materialize: vi.fn(),
  scope: vi.fn(),
  claim: vi.fn(),
  lock: vi.fn(),
  finish: vi.fn(),
  receipt: vi.fn(),
  dead: vi.fn(),
  renew: vi.fn(),
}));
vi.mock("@atlas/events/repositories/outbox-job.repository", () => ({
  materializeDeliveryJobs: mocks.materialize,
  readMaterializationScope: mocks.scope,
  claimDeliveryJob: mocks.claim,
  lockDeliveryJob: mocks.lock,
  finishDeliveryJob: mocks.finish,
  renewDeliveryLease: mocks.renew,
}));
vi.mock("@atlas/events/repositories/event-delivery.repository", () => ({
  insertEventDeliveryAttempt: mocks.receipt,
}));
vi.mock("@atlas/events/repositories/dead-letter.repository", () => ({
  insertDeadLetterEvent: mocks.dead,
}));
import {
  processOutboxBatch,
  MATERIALIZE_LATE_COMMIT_MARGIN_MS,
  resetMaterializationWindows,
  OutboxDeliveryError,
  deliveryIdempotencyKey,
  retryDelayMs,
} from "@atlas/events/services/outbox-worker.service";
const job = {
  id: "job",
  outbox_event_id: "event",
  destination_key: "test.destination",
  status: "processing",
  lease_token: "lease",
  attempt_count: 1,
  cycle_attempt_count: 1,
  max_attempts: 4,
};
const event = {
  id: "event",
  tenant_id: "tenant",
  event_type: "course.published",
  payload_json: { courseId: "course" },
  metadata_json: { requestId: "request" },
};
let depth = 0;
const tx = { $queryRaw: vi.fn() } as EventsDbTx;
const db = {
  transaction: async <T>(fn: (tx: EventsDbTx) => Promise<T>) => {
    depth++;
    try {
      return await fn(tx);
    } finally {
      depth--;
    }
  },
};
const execute = (handle: () => Promise<void>, retryOnCrash = true) =>
  processOutboxBatch(db, {
    limit: 2,
    maxRetries: 3,
    handlers: {
      "course.published": [{ destinationKey: job.destination_key, retryOnCrash, handle }],
    },
  });
describe("durable outbox transaction and retry policy", () => {
  it("renews a long-running handler lease in short independent transactions", async () => {
    vi.useFakeTimers();
    try {
      mocks.renew.mockImplementation(async () => {
        expect(depth).toBe(1);
        return true;
      });
      await execute(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
        expect(mocks.renew).toHaveBeenCalledTimes(1);
        expect(depth).toBe(0);
      });
      expect(mocks.renew).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    depth = 0;
    mocks.claim
      .mockResolvedValueOnce({ job, event, recovered: false, exhausted: false })
      .mockResolvedValue(null);
    mocks.lock.mockResolvedValue(job);
    mocks.dead.mockResolvedValue({ id: "dead" });
  });
  it("commits claim before invoking the handler and records outcome in a new transaction", async () => {
    const handle = vi.fn(async () => {
      expect(depth).toBe(0);
    });
    const result = await execute(handle);
    expect(result.delivered).toBe(1);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: deliveryIdempotencyKey(event.id, job.destination_key),
        attempt: 1,
      }),
    );
    expect(mocks.finish).toHaveBeenCalledWith(
      tx,
      job,
      expect.objectContaining({ status: "succeeded" }),
    );
  });
  it("schedules first transient failure without dead-lettering", async () => {
    await execute(async () => {
      throw new Error("provider secret must not be stored");
    });
    expect(mocks.dead).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      tx,
      job,
      expect.objectContaining({ status: "retry", delayMs: expect.any(Number) }),
    );
    expect(JSON.stringify(mocks.receipt.mock.calls)).not.toContain("provider secret");
  });
  it("dead-letters after the persisted budget is exhausted", async () => {
    mocks.lock.mockResolvedValue({ ...job, attempt_count: 4, cycle_attempt_count: 4 });
    await execute(async () => {
      throw new Error("down");
    });
    expect(mocks.dead).toHaveBeenCalledWith(tx, expect.objectContaining({ retryCount: 3 }));
    expect(mocks.finish).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      expect.objectContaining({ status: "dead" }),
    );
  });
  it("permanent failure stops on its first attempt", async () => {
    await execute(async () => {
      throw new OutboxDeliveryError("permanent", "INVALID_DESTINATION");
    });
    expect(mocks.dead).toHaveBeenCalledTimes(1);
  });
  it("uncertain acceptance is held for reconciliation", async () => {
    await execute(async () => {
      throw new OutboxDeliveryError("reconciliation_required", "SMTP_OUTCOME_UNKNOWN");
    });
    expect(mocks.finish).toHaveBeenCalledWith(
      tx,
      job,
      expect.objectContaining({ status: "reconciliation_required" }),
    );
  });
  it("does not resubmit an interrupted non-idempotent delivery", async () => {
    mocks.claim
      .mockReset()
      .mockResolvedValueOnce({ job, event, recovered: true, exhausted: false })
      .mockResolvedValue(null);
    const handle = vi.fn();
    await execute(handle, false);
    expect(handle).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      tx,
      job,
      expect.objectContaining({ status: "reconciliation_required" }),
    );
  });
  it("fences a stale worker result", async () => {
    mocks.lock.mockResolvedValue({ ...job, lease_token: "newer-lease" });
    expect((await execute(async () => {})).skipped).toBe(1);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("does not reclassify a database result failure as a handler error", async () => {
    mocks.receipt.mockRejectedValue(new Error("commit failed"));
    await expect(execute(async () => {})).rejects.toThrow("commit failed");
    expect(mocks.dead).not.toHaveBeenCalled();
  });
  it("scans all history once, then only events since the last completed pass", async () => {
    resetMaterializationWindows();
    mocks.claim.mockReset().mockResolvedValue(null);
    const at = (iso: string) => ({ tenant: "tenant-a", startedAt: new Date(iso) });
    const after = (call: number) => mocks.materialize.mock.calls[call]?.[4] as Date;

    // First pass in this process: all history. It fills the batch (limit 2),
    // so the next pass must start from the same point.
    mocks.scope.mockResolvedValueOnce(at("2026-11-08T10:00:00Z"));
    mocks.materialize.mockResolvedValueOnce(2);
    await execute(async () => {});
    expect(after(0).getTime()).toBe(0);

    mocks.scope.mockResolvedValueOnce(at("2026-11-08T10:00:05Z"));
    mocks.materialize.mockResolvedValueOnce(1);
    await execute(async () => {});
    expect(after(1).getTime()).toBe(0);

    // That pass left nothing waiting: later passes look back from its start,
    // with the late-commit margin.
    mocks.scope.mockResolvedValueOnce(at("2026-11-08T10:00:10Z"));
    mocks.materialize.mockResolvedValueOnce(0);
    await execute(async () => {});
    expect(after(2).getTime()).toBe(
      new Date("2026-11-08T10:00:05Z").getTime() - MATERIALIZE_LATE_COMMIT_MARGIN_MS,
    );

    // Another tenant keeps its own window and starts with a full pass.
    mocks.scope.mockResolvedValueOnce({ tenant: "tenant-b", startedAt: new Date() });
    mocks.materialize.mockResolvedValueOnce(0);
    await execute(async () => {});
    expect(after(3).getTime()).toBe(0);
  });
  it("keeps the window where it was when the materialization rolls back", async () => {
    resetMaterializationWindows();
    mocks.claim.mockReset().mockResolvedValue(null);
    mocks.scope.mockResolvedValue({ tenant: "tenant-a", startedAt: new Date() });
    mocks.materialize.mockRejectedValueOnce(new Error("serialization failure"));
    await expect(execute(async () => {})).rejects.toThrow("serialization failure");
    mocks.materialize.mockResolvedValueOnce(0);
    await execute(async () => {});
    expect((mocks.materialize.mock.calls[1]?.[4] as Date).getTime()).toBe(0);
  });
  it("uses stable destination-specific identities and bounded exponential jitter", () => {
    expect(deliveryIdempotencyKey("one", "a")).toBe(deliveryIdempotencyKey("one", "a"));
    expect(deliveryIdempotencyKey("one", "a")).not.toBe(deliveryIdempotencyKey("one", "b"));
    expect(retryDelayMs(1, () => 0)).toBe(2500);
    expect(retryDelayMs(2, () => 1)).toBe(10000);
    expect(retryDelayMs(50, () => 1)).toBe(3600000);
  });
});
