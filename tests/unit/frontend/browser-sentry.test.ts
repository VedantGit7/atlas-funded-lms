// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const sdk = vi.hoisted(() => ({ loads: 0, init: vi.fn() }));
vi.mock("../../../frontend/apps/web/node_modules/@sentry/nextjs", () => {
  sdk.loads += 1;
  return { init: sdk.init };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
  sdk.loads = 0;
});

/** Renders the root layout's starter; the idle callback runs only when the test says so. */
async function renderStarter() {
  let idle: (() => void) | undefined;
  const requestIdleCallback = vi.fn((fn: () => void) => ((idle = fn), 1));
  vi.stubGlobal("requestIdleCallback", requestIdleCallback);
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  const { BrowserSentryStarter } =
    await import("../../../frontend/apps/web/src/observability/BrowserSentryStarter");
  const root = createRoot(document.createElement("div"));
  await act(() => root.render(createElement(BrowserSentryStarter)));
  return { requestIdleCallback, idle: () => idle?.(), unmount: () => act(() => root.unmount()) };
}

it("starts browser Sentry once the page is idle, with build-time values only", async () => {
  // Sentry's sentry.client.config.ts is never loaded by a Turbopack build.
  const web = resolve(import.meta.dirname, "../../../frontend/apps/web");
  expect(existsSync(resolve(web, "sentry.client.config.ts"))).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@sentry.example.test/1");
  vi.stubEnv("ATLAS_BUILD_APP_ENV", "staging");
  vi.stubEnv("ATLAS_BUILD_RELEASE", "0123456789abcdef0123456789abcdef01234567");
  const page = await renderStarter();
  try {
    // Not part of first load (audit H16): nothing loads until the page is idle.
    expect(sdk.loads).toBe(0);
    page.idle();
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
    expect(sdk.init).toHaveBeenCalledWith({
      dsn: "https://public@sentry.example.test/1",
      enabled: true,
      environment: "staging",
      release: "0123456789abcdef0123456789abcdef01234567",
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
    });
  } finally {
    await page.unmount();
  }
});

it("never loads browser Sentry in a build without a DSN", async () => {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
  const page = await renderStarter();
  try {
    expect(page.requestIdleCallback).not.toHaveBeenCalled();
    expect(sdk.loads).toBe(0);
  } finally {
    await page.unmount();
  }
});
