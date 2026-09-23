import { describe, expect, it, vi } from "vitest";
import { createDurableUsageRecorder } from "@atlas/api/tenant-usage-meter";
const tenantId = "018f0000-0000-7000-8000-00000000000a";

describe("F22 durable usage recording", () => {
  it("does not acknowledge recording until its durable write finishes", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = vi.fn(async () => gate);
    const record = createDurableUsageRecorder({ writer });
    let acknowledged = false;
    const pending = record(tenantId, { requests: 1 }).then(() => {
      acknowledged = true;
    });
    await Promise.resolve();
    expect(writer).toHaveBeenCalledOnce();
    expect(acknowledged).toBe(false);
    release();
    await pending;
    expect(acknowledged).toBe(true);
  });
  it("retries ambiguous writes with the same event identity", async () => {
    const writer = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue(undefined);
    const record = createDurableUsageRecorder({ writer });
    await record(tenantId, { requests: 1, emails: 2 }, new Date("2026-10-01T00:00:01Z"));
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer.mock.calls[0]?.[0]).toEqual(writer.mock.calls[1]?.[0]);
    expect(writer.mock.calls[0]?.[0].periodStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
  it("reports exhausted persistence failure without throwing into a business request", async () => {
    const onError = vi.fn();
    const writer = vi.fn().mockRejectedValue(new Error("down"));
    await expect(
      createDurableUsageRecorder({ writer, onError })(tenantId, { requests: 1 }),
    ).resolves.toBe(false);
    expect(writer).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledOnce();
  });
  it("does not store invalid identifiers, dates or empty increments", async () => {
    const writer = vi.fn();
    const record = createDurableUsageRecorder({ writer });
    await record("invalid", { requests: 1 });
    await record(tenantId, { durationMs: NaN });
    await record(tenantId, { requests: 1 }, new Date("invalid"));
    expect(writer).not.toHaveBeenCalled();
  });
});
