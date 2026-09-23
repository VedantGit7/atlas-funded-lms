import { describe, expect, it } from "vitest";
import {
  runOutboxSweep,
  type RetentionTask,
  type SweepOptions,
} from "../../../backend/apps/api/src/worker/outbox-sweep";
import type { OutboxProcessor } from "../../../backend/apps/api/src/worker/outbox-processors";
import {
  createHealthState,
  evaluateLiveness,
} from "../../../backend/apps/api/src/worker/worker-health";

/**
 * Regression tests for audit finding C6: ten outbox batch processors existed,
 * all exported, none ever called by deployed code. Events accumulated in the
 * outbox and were never delivered.
 *
 * These cover the sweep's contract rather than the processors themselves (which
 * need a database): every tenant is visited, every processor is invoked, one
 * failure never silences the rest, and shutdown stops at a clean boundary.
 */

const EMPTY = { processed: 0, delivered: 0, failed: 0, skipped: 0 };

function stubProcessor(name: string, result = EMPTY): OutboxProcessor & { calls: string[] } {
  const calls: string[] = [];
  return {
    name,
    calls,
    run: ({ tenantId }) => {
      calls.push(tenantId);
      return Promise.resolve(result);
    },
  };
}

function options(overrides: Partial<SweepOptions> = {}): SweepOptions {
  return {
    batchLimit: 25,
    maxRetries: 3,
    listTenantIds: () => Promise.resolve(["t1", "t2"]),
    processors: [],
    // These tests are about processor orchestration. The retention tasks talk to
    // a database and an object store, and are injected here for the same reason
    // the processors are -- see the retention tests below for their own coverage.
    retentionTasks: [],
    ...overrides,
  };
}

describe("runOutboxSweep", () => {
  it.each([0, -1, 1.5, 101, Infinity])(
    "rejects unbounded or invalid batch limit %s",
    async (batchLimit) => {
      await expect(runOutboxSweep(options({ batchLimit }))).rejects.toThrow(/between 1 and 100/);
    },
  );
  it("caps heavy work at one claim and signals remaining backlog", async () => {
    let seenLimit: number | undefined;
    const result = await runOutboxSweep(
      options({
        listTenantIds: async () => ["t1"],
        processors: [
          {
            name: "heavy",
            maxBatchLimit: 1,
            run: async ({ limit }) => {
              seenLimit = limit;
              return { ...EMPTY, processed: 1, delivered: 1 };
            },
          },
        ],
      }),
    );
    expect(seenLimit).toBe(1);
    expect(result.saturated).toBe(true);
  });
  it("drains durable usage for inactive and deleted tenants even with no active tenants", async () => {
    const visited: string[] = [];
    const result = await runOutboxSweep(
      options({
        listTenantIds: async () => [],
        listRetentionTenantIds: async () => ["inactive", "deleted"],
        retentionTasks: [
          {
            name: "usage-meter-drain",
            includeInactiveTenants: true,
            run: async ({ tenantId }) => {
              visited.push(tenantId);
              return 25;
            },
          },
        ],
      }),
    );
    expect(visited).toEqual(["inactive", "deleted"]);
    expect(result.usageEventsProcessed).toBe(50);
    expect(result.saturated).toBe(true);
  });
  it("serializes processor calls and resumes unstarted work after a worker restart", async () => {
    const controller = new AbortController();
    const completed = new Set<string>();
    let running = 0;
    let maximum = 0;
    const makeProcessor = (stop: boolean): OutboxProcessor => ({
      name: "durable",
      run: async ({ tenantId }) => {
        running++;
        maximum = Math.max(maximum, running);
        await Promise.resolve();
        const processed = completed.has(tenantId) ? 0 : 1;
        completed.add(tenantId);
        running--;
        if (stop) controller.abort();
        return { ...EMPTY, processed, delivered: processed };
      },
    });
    const first = await runOutboxSweep(
      options({ signal: controller.signal, processors: [makeProcessor(true)] }),
    );
    expect(first.abortedEarly).toBe(true);
    expect([...completed]).toEqual(["t1"]);
    const restarted = await runOutboxSweep(options({ processors: [makeProcessor(false)] }));
    expect(restarted.delivered).toBe(1);
    expect([...completed]).toEqual(["t1", "t2"]);
    expect(maximum).toBe(1);
  });
  it("cleans up exports for inactive tenants without processing their outbox", async () => {
    const processor = stubProcessor("p");
    const visited: string[] = [];
    const result = await runOutboxSweep(
      options({
        processors: [processor],
        listTenantIds: async () => ["active"],
        listRetentionTenantIds: async () => ["active", "inactive", "deleted"],
        retentionTasks: [
          {
            name: "export-file-purge",
            includeInactiveTenants: true,
            run: async ({ tenantId }) => {
              visited.push(tenantId);
              return 1;
            },
          },
        ],
      }),
    );
    expect(processor.calls).toEqual(["active"]);
    expect(visited).toEqual(["active", "inactive", "deleted"]);
    expect(result.exportFilesPurged).toBe(3);
  });
  it("invokes every processor for every active tenant", async () => {
    const a = stubProcessor("a");
    const b = stubProcessor("b");

    const result = await runOutboxSweep(options({ processors: [a, b] }));

    expect(a.calls).toEqual(["t1", "t2"]);
    expect(b.calls).toEqual(["t1", "t2"]);
    expect(result.tenants).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("aggregates counters across tenants and processors", async () => {
    const a = stubProcessor("a", { processed: 3, delivered: 2, failed: 1, skipped: 0 });
    const b = stubProcessor("b", { processed: 1, delivered: 0, failed: 0, skipped: 1 });

    const result = await runOutboxSweep(options({ processors: [a, b] }));

    expect(result).toMatchObject({ processed: 8, delivered: 4, failed: 2, skipped: 2 });
  });

  it("isolates a failing processor so the others still drain", async () => {
    const poison: OutboxProcessor = {
      name: "poison",
      run: () => Promise.reject(new Error("downstream is down")),
    };
    const healthy = stubProcessor("healthy", { ...EMPTY, processed: 2, delivered: 2 });

    const result = await runOutboxSweep(options({ processors: [poison, healthy] }));

    // Both tenants still got the healthy processor.
    expect(healthy.calls).toEqual(["t1", "t2"]);
    expect(result.delivered).toBe(4);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ processor: "poison", tenantId: "t1" });
    expect(result.errors[0]?.message).toContain("downstream is down");
  });

  it("isolates a failing tenant so other tenants still drain", async () => {
    const processor: OutboxProcessor = {
      name: "p",
      run: ({ tenantId }) =>
        tenantId === "t1"
          ? Promise.reject(new Error("tenant tx rejected"))
          : Promise.resolve({ ...EMPTY, processed: 1, delivered: 1 }),
    };

    const result = await runOutboxSweep(options({ processors: [processor] }));

    expect(result.delivered).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it("truncates error messages so a huge downstream error cannot flood the logs", async () => {
    const processor: OutboxProcessor = {
      name: "p",
      run: () => Promise.reject(new Error("x".repeat(5_000))),
    };

    const result = await runOutboxSweep(
      options({ processors: [processor], listTenantIds: () => Promise.resolve(["t1"]) }),
    );

    expect(result.errors[0]?.message.length).toBe(500);
  });

  it("reports saturation when a processor fills its batch, so the loop skips its idle wait", async () => {
    const full = stubProcessor("full", { ...EMPTY, processed: 25, delivered: 25 });
    const idle = stubProcessor("idle");

    expect((await runOutboxSweep(options({ processors: [full] }))).saturated).toBe(true);
    expect((await runOutboxSweep(options({ processors: [idle] }))).saturated).toBe(false);
  });

  it("stops at the next boundary when shutdown is requested", async () => {
    const controller = new AbortController();
    const seen: string[] = [];
    const processor: OutboxProcessor = {
      name: "p",
      run: ({ tenantId }) => {
        seen.push(tenantId);
        controller.abort();
        return Promise.resolve(EMPTY);
      },
    };

    const result = await runOutboxSweep(
      options({
        processors: [processor],
        listTenantIds: () => Promise.resolve(["t1", "t2", "t3"]),
        signal: controller.signal,
      }),
    );

    // Finished the in-flight unit of work, then stopped — no work is abandoned
    // mid-transaction and no further tenants are started.
    expect(seen).toEqual(["t1"]);
    expect(result.abortedEarly).toBe(true);
  });

  it("handles a platform with no active tenants", async () => {
    const result = await runOutboxSweep(
      options({ processors: [stubProcessor("a")], listTenantIds: () => Promise.resolve([]) }),
    );
    expect(result).toMatchObject({ tenants: 0, processed: 0, saturated: false });
  });
});

describe("evaluateLiveness", () => {
  it("is healthy while sweeps complete", () => {
    const state = createHealthState();
    state.lastSweepFinishedAt = Date.now();
    expect(evaluateLiveness(state, 60_000).healthy).toBe(true);
  });

  it("grants a grace window before the first sweep completes", () => {
    const state = createHealthState();
    expect(evaluateLiveness(state, 60_000).healthy).toBe(true);
  });

  it("reports unhealthy when the loop has stopped ticking", () => {
    const state = createHealthState();
    state.startedAt = Date.now() - 180_000;
    state.lastSweepFinishedAt = Date.now() - 120_000;

    const liveness = evaluateLiveness(state, 60_000);
    expect(liveness.healthy).toBe(false);
    expect(liveness.reason).toContain("no completed sweep");
  });

  it("remains live while bounded work progresses during a large tenant sweep", () => {
    const state = createHealthState();
    state.startedAt = Date.now() - 600_000;
    state.lastSweepFinishedAt = Date.now() - 400_000;
    state.lastProgressAt = Date.now();
    expect(evaluateLiveness(state, 300_000).healthy).toBe(true);
  });

  it("reports unhealthy after repeated total sweep failure", () => {
    const state = createHealthState();
    state.lastSweepFinishedAt = Date.now();
    state.consecutiveFailedSweeps = 5;

    expect(evaluateLiveness(state, 60_000)).toMatchObject({ healthy: false });
  });

  it("an idle worker with nothing to do is still healthy", () => {
    const state = createHealthState();
    state.lastSweepFinishedAt = Date.now();
    state.sweeps = 500;
    expect(evaluateLiveness(state, 60_000).healthy).toBe(true);
  });
});

describe("retention tasks (M10, M12)", () => {
  const task = (name: string, run: RetentionTask["run"]): RetentionTask => ({ name, run });

  it("runs every retention task for every tenant", async () => {
    const seen: string[] = [];
    const result = await runOutboxSweep(
      options({
        retentionTasks: [
          task("idempotency-purge", ({ tenantId }) => {
            seen.push(`idem:${tenantId}`);
            return Promise.resolve(2);
          }),
          task("proctoring-media-purge", ({ tenantId }) => {
            seen.push(`media:${tenantId}`);
            return Promise.resolve(1);
          }),
        ],
      }),
    );

    expect(seen).toEqual(["idem:t1", "media:t1", "idem:t2", "media:t2"]);
    expect(result.idempotencyRecordsPurged).toBe(4);
    expect(result.proctoringMediaPurged).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("isolates a failing retention task from the rest of the sweep", async () => {
    // A storage outage must not stop the other tenants being swept, and must
    // not be silent either — it lands in errors so the worker logs it.
    const result = await runOutboxSweep(
      options({
        retentionTasks: [
          task("proctoring-media-purge", ({ tenantId }) =>
            tenantId === "t1" ? Promise.reject(new Error("storage down")) : Promise.resolve(3),
          ),
        ],
      }),
    );

    expect(result.proctoringMediaPurged).toBe(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      processor: "proctoring-media-purge",
      tenantId: "t1",
      message: "storage down",
    });
  });

  it("stops retention work when shutdown is requested", async () => {
    const controller = new AbortController();
    const seen: string[] = [];
    const result = await runOutboxSweep(
      options({
        signal: controller.signal,
        retentionTasks: [
          task("idempotency-purge", ({ tenantId }) => {
            seen.push(tenantId);
            controller.abort();
            return Promise.resolve(1);
          }),
          task("must-not-start", () => {
            throw new Error("started work after shutdown");
          }),
        ],
      }),
    );

    expect(seen).toEqual(["t1"]);
    expect(result.abortedEarly).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
