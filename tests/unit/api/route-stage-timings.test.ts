import { describe, expect, it, vi } from "vitest";
import { createRouteStageTimings } from "../../../backend/packages/api/src/route-stage-timings";

describe("bounded route stage timings", () => {
  it("shares one process collector across module reloads", async () => {
    let now = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const output = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("ATLAS_ROUTE_STAGE_TIMINGS", "1");
    try {
      const first = await import("../../../backend/packages/api/src/route-stage-timings");
      await first.measureRouteStage("authentication", async () => {
        now = 30_000;
      });
      vi.resetModules();
      const second = await import("../../../backend/packages/api/src/route-stage-timings");
      await second.measureRouteStage("authentication", async () => {
        now = 60_001;
      });
      expect(output).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(output.mock.calls[0]?.[0])).stages.authentication.count).toBe(2);
    } finally {
      clock.mockRestore();
      output.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("measures success and failure without changing their values and emits no request data", async () => {
    let now = 0;
    const emit = vi.fn();
    const timings = createRouteStageTimings({ now: () => now, emit, intervalMs: 100 });
    expect(
      await timings.measure("authentication", async () => {
        now = 20;
        return "private-result";
      }),
    ).toBe("private-result");
    const failure = new Error("private-error");
    await expect(
      timings.measure("tenant_total", async () => {
        now = 120;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[0]).toMatchObject({
      message: "route.stage_timings",
      elapsedMs: 120,
      stages: {
        authentication: { count: 1, errors: 0, totalMs: 20, maxMs: 20 },
        tenant_total: { count: 1, errors: 1, totalMs: 100, maxMs: 100 },
      },
    });
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(/private-result|private-error/);
  });

  it("uses a fixed number of buckets and labels across a long run", async () => {
    let now = 0;
    const emit = vi.fn();
    const timings = createRouteStageTimings({ now: () => now, emit, intervalMs: 100 });
    for (let index = 0; index < 10_000; index++) {
      await timings.measure("global_total", async () => {
        now += 1;
      });
    }
    expect(emit).toHaveBeenCalledTimes(100);
    const last = emit.mock.calls.at(-1)?.[0];
    expect(Object.keys(last.stages)).toHaveLength(6);
    expect(last.stages.global_total.count).toBe(10_000);
    expect(last.stages.global_total.buckets).toHaveLength(12);
    expect(last.stages.global_total.buckets.reduce((a: number, b: number) => a + b, 0)).toBe(
      10_000,
    );
    expect(JSON.stringify(last).length).toBeLessThan(2_000);
  });

  it("does not let telemetry writer failures replace a business result", async () => {
    let now = 0;
    const timings = createRouteStageTimings({
      now: () => now,
      intervalMs: 1,
      emit: () => {
        throw new Error("logger unavailable");
      },
    });
    expect(
      await timings.measure("usage", async () => {
        now = 2;
        return 42;
      }),
    ).toBe(42);
  });
});
