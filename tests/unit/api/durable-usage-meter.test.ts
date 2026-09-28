import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDurableUsageRecorder,
  createTenantRequestUsage,
  recordTenantUsage,
} from "@atlas/api/tenant-usage-meter";
import type { TenantTx } from "@atlas/db";
import {
  UsageAdmissionError,
  createBoundedUsageBatcher,
  closeUsageMeteringPool,
} from "@atlas/db/metering-client";
const tenantId = "018f0000-0000-7000-8000-00000000000a";
afterEach(() => vi.useRealTimers());

describe("F22 durable usage recording", () => {
  it("supports replaying a captured event without replacing its identity or month", async () => {
    const writer = vi
      .fn()
      .mockRejectedValueOnce(new Error("lost commit"))
      .mockResolvedValue(undefined);
    const record = createDurableUsageRecorder({ writer });
    const event = {
      id: "018f0000-0000-7000-8000-000000000001",
      tenantId,
      periodStart: new Date("2026-09-01T00:00:00Z"),
      requests: 1,
      durationMs: 12,
      emails: 0,
    };
    expect(typeof record.recordEvent).toBe("function");
    expect(await record.recordEvent(event)).toBe(true);
    expect(writer.mock.calls.map(([item]) => item)).toEqual([event, event]);
  });
  it("commits request usage with the supplied transaction and skips post-commit admission", async () => {
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const execute = vi.fn().mockResolvedValue(1);
    try {
      expect(typeof createTenantRequestUsage).toBe("function");
      const usage = createTenantRequestUsage(tenantId);
      await usage.append({ $executeRaw: execute } as unknown as TenantTx, {
        requests: 1,
        durationMs: 12,
      });
      usage.committed();
      expect(await usage.fallback({ requests: 1, durationMs: 40 })).toBe(true);
      expect(execute).toHaveBeenCalledOnce();
      expect(execute.mock.calls[0]?.slice(2)).toEqual([tenantId, expect.any(Date), 1, 12, 0]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("reuses the transaction event after an uncertain commit without measuring it twice", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const previous = {
      batcher: globalThis.__atlasUsageBatcher,
      closed: globalThis.__atlasUsageMeteringClosed,
    };
    const writer = vi.fn().mockResolvedValue(undefined);
    globalThis.__atlasUsageBatcher = createBoundedUsageBatcher(writer);
    globalThis.__atlasUsageMeteringClosed = false;
    try {
      const execute = vi.fn().mockResolvedValue(1);
      const usage = createTenantRequestUsage(tenantId);
      await usage.append({ $executeRaw: execute } as unknown as TenantTx, {
        requests: 1,
        durationMs: 12,
      });
      const fallback = usage.fallback({ requests: 1, durationMs: 90 });
      await vi.advanceTimersByTimeAsync(5);
      expect(await fallback).toBe(true);
      expect(writer).toHaveBeenCalledOnce();
      expect(writer.mock.calls[0]?.[0]).toEqual([
        {
          id: execute.mock.calls[0]?.[1],
          tenantId,
          periodStart: execute.mock.calls[0]?.[3],
          requests: 1,
          durationMs: 12,
          emails: 0,
        },
      ]);
    } finally {
      globalThis.__atlasUsageBatcher = previous.batcher;
      globalThis.__atlasUsageMeteringClosed = previous.closed;
      vi.unstubAllEnvs();
    }
  });
  it("keeps transactional request metering disabled under tests unless explicitly enabled", async () => {
    const execute = vi.fn();
    const usage = createTenantRequestUsage(tenantId);
    await usage.append({ $executeRaw: execute } as unknown as TenantTx, { requests: 1 });
    usage.committed();
    expect(await usage.fallback({ requests: 1 })).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
  it("still records a failed request that never reaches transactional usage insertion", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const previous = {
      batcher: globalThis.__atlasUsageBatcher,
      closed: globalThis.__atlasUsageMeteringClosed,
    };
    const writer = vi.fn().mockResolvedValue(undefined);
    globalThis.__atlasUsageBatcher = createBoundedUsageBatcher(writer);
    globalThis.__atlasUsageMeteringClosed = false;
    try {
      const usage = createTenantRequestUsage(tenantId);
      const fallback = usage.fallback({ requests: 1, durationMs: 90 });
      await vi.advanceTimersByTimeAsync(5);
      expect(await fallback).toBe(true);
      expect(writer.mock.calls[0]?.[0]).toEqual([
        expect.objectContaining({ tenantId, requests: 1, durationMs: 90 }),
      ]);
    } finally {
      globalThis.__atlasUsageBatcher = previous.batcher;
      globalThis.__atlasUsageMeteringClosed = previous.closed;
      vi.unstubAllEnvs();
    }
  });
  it("reports failed-request admission rejection without replacing the business failure", async () => {
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const previousClosed = globalThis.__atlasUsageMeteringClosed;
    globalThis.__atlasUsageMeteringClosed = true;
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const usage = createTenantRequestUsage(tenantId);
      expect(await usage.fallback({ requests: 1, durationMs: 90 })).toBe(false);
      expect(JSON.parse(output.mock.calls[0]?.[0] as string)).toMatchObject({
        message: "usage_meter.persistence_failed",
        failureKind: "admission",
        admissionReason: "closed",
      });
    } finally {
      globalThis.__atlasUsageMeteringClosed = previousClosed;
      output.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("public flush awaits a retry rejected by terminal shutdown without recreating the pool", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const previous = {
      batcher: globalThis.__atlasUsageBatcher,
      pool: globalThis.__atlasUsagePgPool,
      closed: globalThis.__atlasUsageMeteringClosed,
    };
    const writer = vi.fn().mockRejectedValue(new Error("database down"));
    globalThis.__atlasUsageBatcher = createBoundedUsageBatcher(writer);
    globalThis.__atlasUsagePgPool = undefined;
    globalThis.__atlasUsageMeteringClosed = false;
    try {
      const recording = recordTenantUsage(tenantId, { requests: 1 });
      await vi.advanceTimersByTimeAsync(5);
      await closeUsageMeteringPool();
      vi.resetModules();
      const reloaded = await import("@atlas/api/tenant-usage-meter");
      let flushed = false;
      const flushing = reloaded.flushTenantUsageMeter().then(() => {
        flushed = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(flushed).toBe(false);
      expect(output).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(25);
      await Promise.all([recording, flushing]);
      expect(output).toHaveBeenCalledOnce();
      expect(JSON.parse(output.mock.calls[0]?.[0] as string)).toMatchObject({
        failureKind: "admission",
        admissionReason: "closed",
      });
      expect(writer).toHaveBeenCalledOnce();
      expect(globalThis.__atlasUsagePgPool).toBeUndefined();
      expect(globalThis.__atlasUsageBatcher).toBeUndefined();
    } finally {
      globalThis.__atlasUsageBatcher = previous.batcher;
      globalThis.__atlasUsagePgPool = previous.pool;
      globalThis.__atlasUsageMeteringClosed = previous.closed;
      output.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("flush waits through delayed retry and terminal failure reporting", async () => {
    vi.useFakeTimers();
    const writer = vi.fn().mockRejectedValue(new Error("database down"));
    const onError = vi.fn();
    const record = createDurableUsageRecorder({ writer, onError });
    const pending = record(tenantId, { requests: 1 });
    await vi.advanceTimersByTimeAsync(1);
    let flushed = false;
    const flushing = record.flush().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(writer).toHaveBeenCalledOnce();
    expect(flushed).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(25);
    expect(await pending).toBe(false);
    await flushing;
    expect(writer).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(flushed).toBe(true);
  });
  it("does not immediately retry a saturated queue admission", async () => {
    const writer = vi.fn().mockRejectedValue(new UsageAdmissionError("queue capacity exceeded"));
    const onError = vi.fn();
    await expect(
      createDurableUsageRecorder({ writer, onError })(tenantId, { requests: 1 }),
    ).resolves.toBe(false);
    expect(writer).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });
  it("does not acknowledge recording until its durable write finishes", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = vi.fn(async () => gate);
    const record = createDurableUsageRecorder({ writer });
    let acknowledged = false;
    const pending = record(tenantId, { requests: 1 }).then(() => {
      acknowledged = true;
    });
    await Promise.resolve();
    expect(writer).toHaveBeenCalledOnce();
    expect(acknowledged).toBe(false);
    release();
    await pending;
    expect(acknowledged).toBe(true);
  });
  it("retries ambiguous writes with the same event identity", async () => {
    const writer = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue(undefined);
    const record = createDurableUsageRecorder({ writer });
    await record(tenantId, { requests: 1, emails: 2 }, new Date("2026-10-01T00:00:01Z"));
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer.mock.calls[0]?.[0]).toEqual(writer.mock.calls[1]?.[0]);
    expect(writer.mock.calls[0]?.[0].periodStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
  it("reports exhausted persistence failure without throwing into a business request", async () => {
    const onError = vi.fn();
    const writer = vi.fn().mockRejectedValue(new Error("down"));
    await expect(
      createDurableUsageRecorder({ writer, onError })(tenantId, { requests: 1 }),
    ).resolves.toBe(false);
    expect(writer).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledOnce();
  });
  it("does not store invalid identifiers, dates or empty increments", async () => {
    const writer = vi.fn();
    const record = createDurableUsageRecorder({ writer });
    await record("invalid", { requests: 1 });
    await record(tenantId, { durationMs: NaN });
    await record(tenantId, { requests: 1 }, new Date("invalid"));
    expect(writer).not.toHaveBeenCalled();
  });
});
