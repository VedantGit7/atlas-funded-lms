import { beforeEach, describe, expect, it, vi } from "vitest";

/** The API warms the SVG sanitizer at startup without ever failing it (audit M8 follow-up). */

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
const preload = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("@atlas/observability/logger", () => ({ structuredLogger: logger }));
vi.mock("@atlas/storage/svg-sanitize", () => ({
  preloadSvgSanitizer: (...args: unknown[]) => preload.fn(...args),
}));

describe("startup warm-up", () => {
  beforeEach(() => {
    vi.resetModules();
    logger.info.mockClear();
    logger.warn.mockClear();
    preload.fn.mockReset();
  });

  it("reports how long the load took", async () => {
    preload.fn.mockResolvedValue(undefined);
    const { warmSvgSanitizer } =
      await import("../../../backend/apps/api/src/server/warm-svg-sanitizer");
    await warmSvgSanitizer();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "storage.svg_sanitizer_ready",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("never fails startup when the load fails", async () => {
    preload.fn.mockRejectedValue(new Error("no jsdom"));
    const { warmSvgSanitizer } =
      await import("../../../backend/apps/api/src/server/warm-svg-sanitizer");
    await expect(warmSvgSanitizer()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "storage.svg_sanitizer_preload_failed" }),
    );
  });
});
