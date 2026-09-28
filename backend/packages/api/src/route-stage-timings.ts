const stages = [
  "authentication",
  "global_total",
  "global_work",
  "tenant_total",
  "tenant_work",
  "usage",
] as const;
export type RouteStage = (typeof stages)[number];
const boundsMs = [1, 5, 10, 25, 50, 100, 250, 500, 1_000, 5_000, 10_000] as const;
const add = (value: number, amount: number) => Math.min(Number.MAX_SAFE_INTEGER, value + amount);

/** Fixed-label cumulative histograms; no identities, raw errors or SQL enter this collector. */
export function createRouteStageTimings(options: {
  now: () => number;
  emit: (record: Record<string, unknown>) => void;
  intervalMs: number;
}) {
  const startedAt = options.now();
  let emittedAt = startedAt;
  const measurements = Object.fromEntries(
    stages.map((stage) => [
      stage,
      {
        count: 0,
        errors: 0,
        totalMs: 0,
        maxMs: 0,
        buckets: Array<number>(boundsMs.length + 1).fill(0),
      },
    ]),
  ) as Record<
    RouteStage,
    { count: number; errors: number; totalMs: number; maxMs: number; buckets: number[] }
  >;
  return {
    async measure<T>(stage: RouteStage, work: () => Promise<T>): Promise<T> {
      const start = options.now();
      let failed = false;
      try {
        return await work();
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        const end = options.now();
        const duration = Math.max(0, end - start);
        const measurement = measurements[stage];
        measurement.count = add(measurement.count, 1);
        measurement.errors = add(measurement.errors, failed ? 1 : 0);
        measurement.totalMs = add(measurement.totalMs, duration);
        measurement.maxMs = Math.max(measurement.maxMs, duration);
        const bucket = boundsMs.findIndex((bound) => duration <= bound);
        const index = bucket === -1 ? boundsMs.length : bucket;
        measurement.buckets[index] = add(measurement.buckets[index] ?? 0, 1);
        if (end - emittedAt >= options.intervalMs) {
          emittedAt = end;
          try {
            options.emit({
              message: "route.stage_timings",
              elapsedMs: Math.round(end - startedAt),
              boundsMs: [...boundsMs, null],
              stages: Object.fromEntries(
                stages.map((name) => [
                  name,
                  {
                    ...measurements[name],
                    totalMs: Math.round(measurements[name].totalMs),
                    maxMs: Math.round(measurements[name].maxMs),
                    buckets: [...measurements[name].buckets],
                  },
                ]),
              ),
            });
          } catch {
            // Diagnostics must not replace the business result or error.
          }
        }
      }
    },
  };
}

const processState = globalThis as typeof globalThis & {
  __atlasRouteStageTimings?: ReturnType<typeof createRouteStageTimings>;
};

/** Opt-in and timer-free. At most one fixed-size snapshot per process per minute. */
export function measureRouteStage<T>(stage: RouteStage, work: () => Promise<T>): Promise<T> {
  if (process.env["ATLAS_ROUTE_STAGE_TIMINGS"] !== "1") return work();
  processState.__atlasRouteStageTimings ??= createRouteStageTimings({
    now: () => performance.now(),
    intervalMs: 60_000,
    emit: (record) => {
      console.info(
        JSON.stringify({ ...record, timestamp: new Date().toISOString(), pid: process.pid }),
      );
    },
  });
  return processState.__atlasRouteStageTimings.measure(stage, work);
}
