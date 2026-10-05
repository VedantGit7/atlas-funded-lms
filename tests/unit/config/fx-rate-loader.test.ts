import { describe, expect, it, vi } from "vitest";
import { createFxRateLoader } from "@atlas/domain-config/services/fx.service";

describe("FX rate loader (audit M5)", () => {
  it("fetches once per sweep and remembers a failure for the rest of it", async () => {
    const ok = vi.fn(async () => ({ asOf: "2026-10-05", rates: { USD: 1, INR: 83 } }));
    const load = createFxRateLoader(ok);
    await Promise.all([load(), load(), load()]);
    expect(ok).toHaveBeenCalledOnce();

    const down = vi.fn(async () => {
      throw new Error("provider down");
    });
    const failing = createFxRateLoader(down);
    await expect(failing()).rejects.toThrow("provider down");
    await expect(failing()).rejects.toThrow("provider down");
    expect(down).toHaveBeenCalledOnce();
  });
});
