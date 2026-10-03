import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  sweep: vi.fn(),
  close: vi.fn(),
  flush: vi.fn(),
  heartbeat: vi.fn(),
}));
vi.mock("@atlas/api/deployment-startup", () => ({
  validateDeploymentStartup: () => ({ deployed: false }),
}));
vi.mock("@atlas/api/tenant-usage-meter", () => ({ flushTenantUsageMeter: mocks.flush }));
vi.mock("@atlas/observability/better-stack/heartbeat", () => ({
  pingWorkerHeartbeat: mocks.heartbeat,
}));
vi.mock("../../../backend/apps/api/src/worker/outbox-sweep", () => ({
  runOutboxSweep: mocks.sweep,
}));
vi.mock("../../../backend/apps/api/src/worker/worker-health", async (original) => ({
  ...(await original<object>()),
  startHealthServer: () => ({ close: mocks.close }),
}));
import { main } from "../../../backend/apps/api/src/worker/main";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe("worker process lifecycle", () => {
  it("finishes its active sweep on SIGTERM and starts fresh without old signal handlers", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("OUTBOX_WORKER_BATCH_LIMIT", "25");
    const previousTerms = process.listenerCount("SIGTERM");
    const previousInts = process.listenerCount("SIGINT");
    const signals: AbortSignal[] = [];
    mocks.sweep.mockImplementation(async ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      expect(signal.aborted).toBe(false);
      process.emit("SIGTERM");
      expect(signal.aborted).toBe(true);
      await Promise.resolve();
      return { processed: 0, usageEventsProcessed: 0, errors: [], saturated: false };
    });
    expect(await main()).toBe(0);
    expect(process.listenerCount("SIGTERM")).toBe(previousTerms);
    expect(process.listenerCount("SIGINT")).toBe(previousInts);
    expect(await main()).toBe(0);
    expect(signals[0]).not.toBe(signals[1]);
    expect(mocks.sweep).toHaveBeenCalledTimes(2);
    expect(mocks.close).toHaveBeenCalledTimes(2);
    expect(mocks.flush).toHaveBeenCalledTimes(2);
    expect(process.listenerCount("SIGTERM")).toBe(previousTerms);
    expect(process.listenerCount("SIGINT")).toBe(previousInts);
  });
  it.each(["25oops", "1.5", "101"])(
    "rejects unsafe local batch setting %s before processing",
    async (value) => {
      vi.stubEnv("OUTBOX_WORKER_BATCH_LIMIT", value);
      await expect(main()).rejects.toThrow(/OUTBOX_WORKER_BATCH_LIMIT/);
      expect(mocks.sweep).not.toHaveBeenCalled();
    },
  );
});
