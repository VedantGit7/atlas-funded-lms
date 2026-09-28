import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBoundedUsageBatcher,
  USAGE_BATCH_DELAY_MS,
  USAGE_BATCH_MAX_EVENTS,
  USAGE_QUEUE_MAX_EVENTS,
  USAGE_QUEUE_TIMEOUT_MS,
  type DurableUsageEvent,
} from "@atlas/db/metering-client";

const event = (index: number, tenantId = "tenant-a"): DurableUsageEvent => ({
  id: String(index),
  tenantId,
  periodStart: new Date("2026-09-01"),
  requests: 1,
  durationMs: 12.5,
  emails: 0,
});
const gate = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
afterEach(() => vi.useRealTimers());

describe("bounded acknowledged usage batches", () => {
  it("coalesces concurrent tenant events and acknowledges every caller only after commit", async () => {
    vi.useFakeTimers();
    const commit = gate();
    const writer = vi.fn(async (_events: readonly DurableUsageEvent[]) => commit.promise);
    const batcher = createBoundedUsageBatcher(writer);
    let acknowledged = 0;
    const pending = Array.from({ length: 32 }, (_, i) =>
      batcher.append(event(i)).then(() => acknowledged++),
    );
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    expect(writer).toHaveBeenCalledOnce();
    expect(writer.mock.calls[0]?.[0]).toEqual(Array.from({ length: 32 }, (_, i) => event(i)));
    expect(acknowledged).toBe(0);
    expect(batcher.snapshot()).toMatchObject({ acknowledgedEvents: 0, retainedEvents: 32 });
    commit.resolve();
    await Promise.all(pending);
    expect(acknowledged).toBe(32);
    expect(batcher.snapshot()).toMatchObject({
      acknowledgedEvents: 32,
      acknowledgedRequests: 32,
      acknowledgedEmails: 0,
      retainedEvents: 0,
      committedBatches: 1,
    });
  });

  it("keeps tenant contexts separate and caps each batch and active database transactions", async () => {
    vi.useFakeTimers();
    const commits: ReturnType<typeof gate>[] = [];
    const writer = vi.fn(async (_events: readonly DurableUsageEvent[]) => {
      const commit = gate();
      commits.push(commit);
      await commit.promise;
    });
    const batcher = createBoundedUsageBatcher(writer);
    const pending = Array.from({ length: USAGE_BATCH_MAX_EVENTS * 3 }, (_, i) =>
      batcher.append(event(i)),
    );
    pending.push(batcher.append(event(999, "tenant-b")));
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer.mock.calls.every(([items]) => items.length <= USAGE_BATCH_MAX_EVENTS)).toBe(true);
    expect(writer.mock.calls[1]?.[0].map((item) => item.tenantId)).toEqual(["tenant-b"]);
    commits[0]?.resolve();
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    expect(writer).toHaveBeenCalledTimes(3);
    expect(writer.mock.calls[2]?.[0]).toHaveLength(USAGE_BATCH_MAX_EVENTS);
    commits[1]?.resolve();
    commits[2]?.resolve();
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    commits[3]?.resolve();
    await Promise.all(pending);
  });

  it("bounds retained events, rejects overload without claiming persistence, and expires queued work", async () => {
    vi.useFakeTimers();
    const commit = gate();
    const writer = vi.fn(async () => commit.promise);
    const batcher = createBoundedUsageBatcher(writer);
    const pending = Array.from({ length: USAGE_QUEUE_MAX_EVENTS }, (_, i) =>
      batcher.append(event(i)),
    );
    const settled = Promise.allSettled(pending);
    await expect(batcher.append(event(9999))).rejects.toThrow("capacity");
    expect(batcher.snapshot()).toMatchObject({
      rejectedAdmissions: 1,
      rejectedCapacity: 1,
      rejectedDeadline: 0,
      rejectedClosed: 0,
    });
    await vi.advanceTimersByTimeAsync(USAGE_QUEUE_TIMEOUT_MS);
    expect(writer).toHaveBeenCalledTimes(2);
    commit.resolve();
    const results = await settled;
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      USAGE_BATCH_MAX_EVENTS * 2,
    );
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(
      USAGE_QUEUE_MAX_EVENTS - USAGE_BATCH_MAX_EVENTS * 2,
    );
    await batcher.flush();
    expect(batcher.snapshot()).toMatchObject({
      rejectedAdmissions: 897,
      rejectedCapacity: 1,
      rejectedDeadline: 896,
      rejectedClosed: 0,
    });
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason.reason).toBe("deadline");
    }
  });

  it("classifies expiry during a delayed dispatch even before the expiry timer runs", async () => {
    vi.useFakeTimers();
    const writer = vi.fn(async () => {});
    const batcher = createBoundedUsageBatcher(writer);
    const result = batcher.append(event(1)).catch((error: unknown) => error);
    vi.setSystemTime(Date.now() + USAGE_QUEUE_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    expect(await result).toMatchObject({ reason: "deadline" });
    expect(writer).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(USAGE_QUEUE_TIMEOUT_MS);
    expect(batcher.snapshot()).toMatchObject({
      rejectedAdmissions: 1,
      rejectedDeadline: 1,
      rejectedCapacity: 0,
      rejectedClosed: 0,
      retainedEvents: 0,
    });
  });

  it("rejects every member of a failed batch and retains the exact IDs on caller replay", async () => {
    vi.useFakeTimers();
    const commit = gate();
    const writer = vi.fn(async (_events: readonly DurableUsageEvent[]) => commit.promise);
    const batcher = createBoundedUsageBatcher(writer);
    const items = [event(1), event(2)];
    const first = Promise.allSettled(items.map((item) => batcher.append(item)));
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    commit.reject(new Error("lost COMMIT response"));
    expect((await first).every((result) => result.status === "rejected")).toBe(true);
    writer.mockResolvedValue(undefined);
    const retry = Promise.all(items.map((item) => batcher.append(item)));
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    await retry;
    expect(writer.mock.calls[1]?.[0]).toEqual(writer.mock.calls[0]?.[0]);
  });

  it("drains admitted work before close resolves and refuses new admissions", async () => {
    vi.useFakeTimers();
    const commit = gate();
    const writer = vi.fn(async () => commit.promise);
    const batcher = createBoundedUsageBatcher(writer);
    const pending = batcher.append(event(1));
    let closed = false;
    const closing = batcher.close().then(() => {
      closed = true;
    });
    await expect(batcher.append(event(2))).rejects.toThrow("closed");
    expect(batcher.snapshot()).toMatchObject({
      rejectedAdmissions: 1,
      rejectedClosed: 1,
      rejectedDeadline: 0,
      rejectedCapacity: 0,
    });
    await vi.advanceTimersByTimeAsync(USAGE_BATCH_DELAY_MS);
    expect(closed).toBe(false);
    commit.resolve();
    await Promise.all([pending, closing]);
    expect(closed).toBe(true);
  });
});
