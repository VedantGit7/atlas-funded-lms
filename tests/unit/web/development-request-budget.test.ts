import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: (config: unknown) => config }));
vi.mock("@next/bundle-analyzer", () => ({ default: () => (config: unknown) => config }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cold development route requests", () => {
  it("allows the development API compiler to finish beyond the default proxy deadline", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { default: config } = await import("../../../frontend/apps/web/next.config");
    expect(config.experimental?.proxyTimeout).toBe(90_000);
  });

  it("keeps the production proxy deadline even when a browser development flag is present", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BROWSER_E2E_DEV", "1");
    const { default: config } = await import("../../../frontend/apps/web/next.config");
    expect(config.experimental?.proxyTimeout ?? 30_000).toBe(30_000);
  });

  it("limits the special navigation allowance to the explicitly selected development harness", async () => {
    const { coldRouteNavigationOptions } = await import("../../browser/helpers/navigation");
    vi.stubEnv("BROWSER_E2E_DEV", "1");
    expect(coldRouteNavigationOptions()).toEqual({ timeout: 60_000 });
    vi.stubEnv("BROWSER_E2E_DEV", "0");
    expect(coldRouteNavigationOptions()).toEqual({});
    vi.stubEnv("BROWSER_E2E_DEV", undefined);
    expect(coldRouteNavigationOptions()).toEqual({});
  });
});
