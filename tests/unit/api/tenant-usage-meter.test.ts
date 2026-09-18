import { describe, expect, it, vi } from "vitest";
import {
  createTenantUsageMeter,
  recordTenantUsage,
  type MeteredBatch,
} from "@atlas/api/tenant-usage-meter";

/**
 * The in-process meter behind per-tenant cost attribution (DoD item 8). Its
 * database write is proven in tests/db/cost-attribution.test.ts; these cover the
 * batching, which is where counts could silently go missing.
 */

const TENANT_A = "018f0000-0000-7000-8000-00000000000a";
const TENANT_B = "018f0000-0000-7000-8000-00000000000b";

function collectingWriter() {
  const batches: MeteredBatch[] = [];
  const writer = vi.fn(async (batch: MeteredBatch) => {
    batches.push(batch);
    await Promise.resolve();
  });
  return { batches, writer };
}

describe("tenant usage meter", () => {
  it("collapses many requests into one write per tenant-month", async () => {
    const { batches, writer } = collectingWriter();
    const meter = createTenantUsageMeter({ writer, intervalMs: 0 });
    const at = new Date("2026-09-18T10:00:00Z");

    for (let i = 0; i < 50; i += 1) meter.record(TENANT_A, { requests: 1, durationMs: 20 }, at);
    meter.record(TENANT_A, { emails: 3 }, at);
    meter.record(TENANT_B, { requests: 1, durationMs: 5 }, at);

    await meter.flush();

    expect(writer).toHaveBeenCalledTimes(2);
    const a = batches.find((batch) => batch.tenantId === TENANT_A);
    expect(a).toMatchObject({ requests: 50, durationMs: 1000, emails: 3 });
    expect(a?.periodStart.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(meter.pendingBuckets()).toBe(0);
  });

  it("keeps a request that happened before midnight on the 1st in the month it happened", async () => {
    const { batches, writer } = collectingWriter();
    const meter = createTenantUsageMeter({ writer, intervalMs: 0 });
    meter.record(TENANT_A, { requests: 1 }, new Date("2026-09-30T23:59:59Z"));
    meter.record(TENANT_A, { requests: 1 }, new Date("2026-10-01T00:00:01Z"));

    await meter.flush();

    expect(batches.map((batch) => batch.periodStart.toISOString()).sort()).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    ]);
  });

  it("puts a failed batch back and merges anything that arrived meanwhile", async () => {
    let fail = true;
    const written: MeteredBatch[] = [];
    const meter = createTenantUsageMeter({
      intervalMs: 0,
      writer: async (batch) => {
        await Promise.resolve();
        if (fail) throw new Error("database unavailable");
        written.push(batch);
      },
    });
    const at = new Date("2026-09-18T10:00:00Z");

    meter.record(TENANT_A, { requests: 5 }, at);
    const first = await meter.flush();
    expect(first).toEqual({ written: 0, failed: 1 });
    expect(meter.pendingBuckets()).toBe(1);

    meter.record(TENANT_A, { requests: 2 }, at);
    fail = false;
    await meter.flush();

    // Nothing dropped, nothing double-counted.
    expect(written).toHaveLength(1);
    expect(written[0]?.requests).toBe(7);
  });

  it("ignores invalid tenant ids and non-positive or non-finite amounts", async () => {
    const { writer } = collectingWriter();
    const meter = createTenantUsageMeter({ writer, intervalMs: 0 });

    meter.record("not-a-uuid", { requests: 1 });
    meter.record(TENANT_A, { requests: 0, durationMs: -5, emails: Number.NaN });
    meter.record(TENANT_A, { durationMs: Number.POSITIVE_INFINITY });

    await meter.flush();
    expect(writer).not.toHaveBeenCalled();
  });

  it("runs one flush at a time", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = vi.fn(async () => gate);
    const meter = createTenantUsageMeter({ writer, intervalMs: 0 });
    meter.record(TENANT_A, { requests: 1 });

    const first = meter.flush();
    const second = meter.flush();
    expect(second).toBe(first);
    release();
    await first;
    expect(writer).toHaveBeenCalledTimes(1);
  });

  it("never throws into the request that is being metered", () => {
    // Metering is off under Vitest by default, and must be a silent no-op.
    expect(() => {
      recordTenantUsage(TENANT_A, { requests: 1 });
    }).not.toThrow();
  });
});
