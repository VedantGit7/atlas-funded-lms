import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { appendDurableUsage, closeUsageMeteringPool } from "@atlas/db/metering-client";
import {
  appendTenantUsageEvent,
  drainTenantUsageEvents,
  type UsageEvent,
} from "@atlas/api/tenant-usage-meter";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

const suite = process.env["DATABASE_URL"] ? describe : describe.skip;
function event(tenantId: string): UsageEvent {
  return {
    id: randomUUID(),
    tenantId,
    periodStart: new Date("2026-09-01T00:00:00Z"),
    requests: 1,
    durationMs: 25,
    emails: 1,
  };
}
suite("F22 durable usage PostgreSQL", () => {
  afterAll(closeUsageMeteringPool);
  it("retains an acknowledged event after producer exits without cleanup and deduplicates replay", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const item = event(tenantA.tenantId);
    const source = `import {appendDurableUsage} from './backend/packages/db/src/metering-client.ts'; const e=JSON.parse(process.env.F22_EVENT); e.periodStart=new Date(e.periodStart); await appendDurableUsage(e); process.exit(17);`;
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", source],
        { env: { ...process.env, F22_EVENT: JSON.stringify(item) }, stdio: "pipe" },
      );
      child.on("error", reject);
      child.on("exit", resolve);
    });
    expect(code).toBe(17);
    await appendDurableUsage(item);
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 1 });
      const rows = await tx.$queryRaw<
        Array<{ metrics: { count: number } }>
      >`SELECT metrics_json AS metrics FROM analytics_rollups WHERE rollup_key='usage.api_requests'`;
      expect(Number(rows[0]?.metrics.count)).toBe(1);
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 0 });
    });
  }, 20000);
  it("rolls back acknowledgement and counters together, then concurrent workers count each event once", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      for (let i = 0; i < 12; i++) await appendTenantUsageEvent(tx, event(tenantA.tenantId));
    });
    await expect(
      withTenantTx(tenantCtx(tenantA), async (tx) => {
        await drainTenantUsageEvents(tx, { limit: 100 });
        throw new Error("simulated worker crash");
      }),
    ).rejects.toThrow("simulated worker crash");
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        withTenantTx(tenantCtx(tenantA), (tx) => drainTenantUsageEvents(tx, { limit: 4 })),
      ),
    );
    expect(results.reduce((n, result) => n + result.processed, 0)).toBe(12);
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ metrics: { count: number; durationMs: number } }>
      >`SELECT metrics_json AS metrics FROM analytics_rollups WHERE rollup_key='usage.api_requests'`;
      expect(Number(rows[0]?.metrics.count)).toBe(12);
      expect(Number(rows[0]?.metrics.durationMs)).toBe(300);
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 0 });
    });
  });
  it("isolates journal rows and retains pending events regardless of age", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    await appendDurableUsage(event(tenantA.tenantId));
    await appendDurableUsage(event(tenantB.tenantId));
    await expect(
      withTenantTx(tenantCtx(tenantA), (tx) => appendTenantUsageEvent(tx, event(tenantB.tenantId))),
    ).rejects.toThrow();
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      await tx.$executeRaw`UPDATE tenant_usage_events SET created_at=now()-interval '90 days'`;
      const rows = await tx.$queryRaw<
        Array<{ tenant_id: string }>
      >`SELECT tenant_id FROM tenant_usage_events`;
      expect(rows.map((row) => row.tenant_id)).toEqual([tenantA.tenantId]);
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 1 });
    });
    await withTenantTx(tenantCtx(tenantB), async (tx) =>
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 1 }),
    );
  });
  it("persists while every business-pool connection is held", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const pool = globalThis.__atlasPgPool;
    if (!pool) throw new Error("Business pool was not initialized");
    const held = await Promise.all(
      Array.from({ length: pool.options.max ?? 20 }, () => pool.connect()),
    );
    try {
      await appendDurableUsage(event(tenantA.tenantId));
    } finally {
      for (const client of held) client.release();
    }
    await withTenantTx(tenantCtx(tenantA), async (tx) =>
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 1 }),
    );
  });
});
