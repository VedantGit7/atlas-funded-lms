import { describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import {
  createDurableUsageRecorder,
  drainTenantUsageEvents,
  pruneTenantUsageEvents,
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
  it("rejects unbounded prune sizes before any query", async () => {
    const execute = vi.fn();
    const tx = { $executeRaw: execute } as unknown as TenantTx;
    for (const limit of [0, -1, 1001, NaN, 1.5])
      await expect(pruneTenantUsageEvents(tx, { limit })).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it("prunes through the primary key, not an IN subquery a generic plan answers with a full scan", async () => {
    let sql = "";
    const tx = {
      $executeRaw: vi.fn((strings: TemplateStringsArray) => {
        sql = strings.join("$");
        return Promise.resolve(3);
      }),
    } as unknown as TenantTx;
    await expect(pruneTenantUsageEvents(tx, { limit: 500 })).resolves.toEqual({ pruned: 3 });
    expect(sql).toContain("WHERE id = ANY(ARRAY(");
    expect(sql).not.toMatch(/\bIN\s*\(/);
  });
  it("leaves pruning out of the drain transaction", async () => {
    const execute = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: execute,
    } as unknown as TenantTx;
    await expect(drainTenantUsageEvents(tx, { limit: 10 })).resolves.toEqual({ processed: 0 });
    expect(execute).not.toHaveBeenCalled();
  });
  it("is disabled under tests unless explicitly enabled", async () => {
    await expect(recordTenantUsage(tenant, { requests: 1 })).resolves.toBeUndefined();
  });
});
