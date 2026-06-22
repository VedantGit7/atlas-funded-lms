import { afterEach, describe, expect, it, vi } from "vitest";
import { pingWorkerHeartbeat } from "@atlas/observability/better-stack/heartbeat";

describe("worker heartbeat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BETTER_STACK_WORKER_HEARTBEAT_URL;
  });

  it("does not throw when heartbeat fails", async () => {
    process.env.BETTER_STACK_WORKER_HEARTBEAT_URL = "https://heartbeat.example/ping";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(pingWorkerHeartbeat(true)).resolves.toBeUndefined();
  });
});
