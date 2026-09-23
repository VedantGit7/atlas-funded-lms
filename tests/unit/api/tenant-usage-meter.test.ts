import { describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import {
  createDurableUsageRecorder,
  drainTenantUsageEvents,
  recordTenantUsage,
} from "@atlas/api/tenant-usage-meter";
const tenant = "018f0000-0000-7000-8000-00000000000a";
describe("tenant usage meter", () => {
  it("keeps the UTC month of each recorded operation", async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const record = createDurableUsageRecorder({ writer });
    await record(tenant, { requests: 1 }, new Date("2026-09-30T23:59:59Z"));
    await record(tenant, { requests: 1 }, new Date("2026-10-01T00:00:01Z"));
    expect(writer.mock.calls.map((call) => call[0].periodStart.toISOString())).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    ]);
  });
  it("uses separate event identities for separate operations", async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const record = createDurableUsageRecorder({ writer });
    await record(tenant, { requests: 1 });
    await record(tenant, { requests: 1 });
    expect(writer.mock.calls[0]?.[0].id).not.toBe(writer.mock.calls[1]?.[0].id);
  });
  it("rejects unbounded drain sizes before any query", async () => {
    const query = vi.fn();
    const tx = { $queryRaw: query } as unknown as TenantTx;
    for (const limit of [0, -1, 1001, NaN, 1.5])
      await expect(drainTenantUsageEvents(tx, { limit })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it("is disabled under tests unless explicitly enabled", async () => {
    await expect(recordTenantUsage(tenant, { requests: 1 })).resolves.toBeUndefined();
  });
});
