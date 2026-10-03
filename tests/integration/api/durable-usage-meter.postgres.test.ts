import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { withTenantTx } from "@atlas/db";
import { Pool } from "pg";
import {
  appendDurableUsage,
  closeUsageMeteringPool,
  createDurableUsageBatchAppender,
} from "@atlas/db/metering-client";
import {
  appendTenantUsageEvent,
  createTenantRequestUsage,
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
  afterEach(() => vi.unstubAllEnvs());
  it("commits business changes and request usage together without dedicated-pool admission", async () => {
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const { tenantA } = await createTenantIsolationFixture();
    const usage = createTenantRequestUsage(tenantA.tenantId);
    const previousClosed = globalThis.__atlasUsageMeteringClosed;
    globalThis.__atlasUsageMeteringClosed = true;
    try {
      await withTenantTx(tenantCtx(tenantA), async (tx) => {
        await tx.$executeRaw`UPDATE courses SET title='Durably metered' WHERE id=${tenantA.courseId}::uuid`;
        await usage.append(tx, { requests: 1, durationMs: 25 });
      });
      usage.committed();
      expect(await usage.fallback({ requests: 1, durationMs: 200 })).toBe(true);
      await withTenantTx(tenantCtx(tenantA), async (tx) => {
        const courses = await tx.$queryRaw<
          Array<{ title: string }>
        >`SELECT title FROM courses WHERE id=${tenantA.courseId}::uuid`;
        expect(courses[0]?.title).toBe("Durably metered");
        const journal = await tx.$queryRaw<
          Array<{ requests: bigint; duration_ms: number }>
        >`SELECT requests,duration_ms FROM tenant_usage_events`;
        expect(journal).toEqual([{ requests: 1n, duration_ms: 25 }]);
      });
    } finally {
      globalThis.__atlasUsageMeteringClosed = previousClosed;
    }
  });
  it("rolls business changes back when transactional usage violates tenant isolation", async () => {
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const usage = createTenantRequestUsage(tenantB.tenantId);
    await expect(
      withTenantTx(tenantCtx(tenantA), async (tx) => {
        await tx.$executeRaw`UPDATE courses SET title='Must roll back' WHERE id=${tenantA.courseId}::uuid`;
        await usage.append(tx, { requests: 1, durationMs: 25 });
      }),
    ).rejects.toThrow();
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      const courses = await tx.$queryRaw<
        Array<{ title: string }>
      >`SELECT title FROM courses WHERE id=${tenantA.courseId}::uuid`;
      expect(courses[0]?.title).toBe(`Course ${tenantA.courseSlug}`);
      const journal = await tx.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*) AS count FROM tenant_usage_events`;
      expect(journal[0]?.count).toBe(0n);
    });
  });
  it("deduplicates fallback after a business commit reply is lost and its usage was already drained", async () => {
    vi.stubEnv("ATLAS_USAGE_METERING", "on");
    const { tenantA } = await createTenantIsolationFixture();
    const usage = createTenantRequestUsage(tenantA.tenantId);
    await expect(
      (async () => {
        await withTenantTx(tenantCtx(tenantA), async (tx) => {
          await tx.$executeRaw`UPDATE courses SET title='Committed before reply loss' WHERE id=${tenantA.courseId}::uuid`;
          await usage.append(tx, { requests: 1, durationMs: 25 });
        });
        throw new Error("simulated lost business COMMIT acknowledgement");
      })(),
    ).rejects.toThrow("lost business COMMIT acknowledgement");
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 1 });
    });
    expect(await usage.fallback({ requests: 1, durationMs: 900 })).toBe(true);
    await withTenantTx(tenantCtx(tenantA), async (tx) => {
      expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 0 });
      const rows = await tx.$queryRaw<Array<{ metrics: { count: number; durationMs: number } }>>`
        SELECT metrics_json AS metrics FROM analytics_rollups WHERE rollup_key='usage.api_requests'`;
      expect(Number(rows[0]?.metrics.count)).toBe(1);
      expect(Number(rows[0]?.metrics.durationMs)).toBe(25);
    });
  });
  it("acknowledges concurrent batches for two tenants and replay counts each event exactly once", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const eventsA = Array.from({ length: 200 }, () => event(tenantA.tenantId));
    const eventsB = Array.from({ length: 70 }, () => event(tenantB.tenantId));
    await Promise.all([...eventsA, ...eventsB].map(appendDurableUsage));
    // Replay through a fresh independent producer pool; global shutdown is terminal.
    const restartedPool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
    try {
      const replay = createDurableUsageBatchAppender(restartedPool);
      for (const events of [eventsA, eventsB]) {
        for (let offset = 0; offset < events.length; offset += 64)
          await replay(events.slice(offset, offset + 64));
      }
    } finally {
      await restartedPool.end();
    }
    for (const [tenant, expected] of [
      [tenantA, 200],
      [tenantB, 70],
    ] as const) {
      await withTenantTx(tenantCtx(tenant), async (tx) => {
        const journal = await tx.$queryRaw<Array<{ count: bigint; requests: bigint }>>`
          SELECT count(*) AS count, sum(requests) AS requests FROM tenant_usage_events`;
        expect(Number(journal[0]?.count)).toBe(expected);
        expect(Number(journal[0]?.requests)).toBe(expected);
        expect(await drainTenantUsageEvents(tx, { limit: 1000 })).toEqual({ processed: expected });
        const rollups = await tx.$queryRaw<Array<{ metrics: { count: number } }>>`
          SELECT metrics_json AS metrics FROM analytics_rollups WHERE rollup_key='usage.api_requests'`;
        expect(Number(rollups[0]?.metrics.count)).toBe(expected);
        expect(await drainTenantUsageEvents(tx, { limit: 1000 })).toEqual({ processed: 0 });
      });
    }
  });
  it("deduplicates the whole batch after PostgreSQL commits but its acknowledgement is lost", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const events = Array.from({ length: 32 }, () => event(tenantA.tenantId));
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
    let loseReply = true;
    const ambiguousPool = {
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async (sql: string, values?: unknown[]) => {
            const result = await client.query(sql, values);
            if (sql === "COMMIT" && loseReply) {
              loseReply = false;
              throw new Error("simulated lost COMMIT acknowledgement");
            }
            return result;
          },
          release: client.release.bind(client),
        };
      },
    } as unknown as Pick<Pool, "connect">;
    try {
      const append = createDurableUsageBatchAppender(ambiguousPool);
      await expect(append(events)).rejects.toThrow("lost COMMIT acknowledgement");
      await append(events);
      await withTenantTx(tenantCtx(tenantA), async (tx) => {
        expect(await drainTenantUsageEvents(tx, { limit: 100 })).toEqual({ processed: 32 });
        const rows = await tx.$queryRaw<Array<{ metrics: { count: number } }>>`
          SELECT metrics_json AS metrics FROM analytics_rollups WHERE rollup_key='usage.api_requests'`;
        expect(Number(rows[0]?.metrics.count)).toBe(32);
      });
    } finally {
      await pool.end();
    }
  });
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
