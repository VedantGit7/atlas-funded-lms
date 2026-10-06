import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The SVG sanitizer is loaded once, ahead of the first upload, and a failed
 * load is retried rather than cached (audit M8 follow-up).
 */

const purify = vi.hoisted(() => ({
  hookFailures: 0,
  addHook: vi.fn(),
  sanitize: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
}));

const fakePurifier = {
  addHook: (...args: unknown[]) => {
    if (purify.hookFailures > 0) {
      purify.hookFailures -= 1;
      throw new Error("jsdom failed to start");
    }
    purify.addHook(...args);
  },
  sanitize: purify.sanitize,
};

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');

describe("SVG sanitizer preload", () => {
  const imports = vi.fn(async () => ({ default: fakePurifier as never }));

  beforeEach(async () => {
    purify.hookFailures = 0;
    purify.addHook.mockClear();
    purify.sanitize.mockClear();
    imports.mockClear();
    const { setSvgSanitizerImportForTests } = await import("@atlas/storage/svg-sanitize");
    setSvgSanitizerImportForTests(imports);
  });

  it("loads once: the preload and later sanitizes share it", async () => {
    const { preloadSvgSanitizer, sanitizeSvg } = await import("@atlas/storage/svg-sanitize");
    await Promise.all([preloadSvgSanitizer(), preloadSvgSanitizer()]);
    await sanitizeSvg(svg);
    await sanitizeSvg(svg);

    // Loaded once, two hooks installed once.
    expect(imports).toHaveBeenCalledOnce();
    expect(purify.addHook).toHaveBeenCalledTimes(2);
    expect(purify.sanitize).toHaveBeenCalledTimes(2);
  });

  it("retries a load that failed instead of failing every upload after it", async () => {
    purify.hookFailures = 1;
    const { preloadSvgSanitizer, sanitizeSvg } = await import("@atlas/storage/svg-sanitize");

    await expect(preloadSvgSanitizer()).rejects.toThrow("jsdom failed to start");
    await expect(sanitizeSvg(svg)).resolves.toBeInstanceOf(Buffer);
    expect(imports).toHaveBeenCalledTimes(2);
  });
});

afterAll(async () => {
  const { setSvgSanitizerImportForTests } = await import("@atlas/storage/svg-sanitize");
  setSvgSanitizerImportForTests(null);
});
