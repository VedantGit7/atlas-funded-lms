import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  loads: 0,
  init: vi.fn(),
  capture: vi.fn(),
  reset: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));
vi.mock("../../../frontend/apps/web/node_modules/posthog-js", () => {
  sdk.loads += 1;
  return { default: sdk };
});

const load = () => import("../../../frontend/apps/web/src/observability/posthog-browser");

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-public-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("consent-gated analytics loading", () => {
  it("does not import the SDK for initial render, absent consent, or an absent key", async () => {
    const analytics = await load();
    expect(sdk.loads).toBe(0);
    analytics.initPostHogBrowser({ analyticsConsent: false });
    await Promise.resolve();
    expect(sdk.loads).toBe(0);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    analytics.initPostHogBrowser({ analyticsConsent: true });
    await Promise.resolve();
    expect(sdk.loads).toBe(0);
  });

  it("initializes once after consent and preserves approved events while loading", async () => {
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("lesson_completed", { source: "lesson", extra: "drop" });
    await vi.waitFor(() =>
      expect(sdk.capture).toHaveBeenCalledWith("lesson_completed", { source: "lesson" }),
    );
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(
      "test-public-key",
      expect.objectContaining({
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        advanced_disable_flags: true,
        opt_out_capturing_by_default: true,
        persistence: "memory",
      }),
    );
  });

  it("does not initialize or replay pending events after consent is revoked", async () => {
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("lesson_completed");
    analytics.setPostHogAnalyticsConsent(false);
    await vi.dynamicImportSettled();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it("invalidates pending initialization and events when logout resets analytics", async () => {
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("lesson_completed");
    analytics.resetPostHogBrowser();
    await vi.dynamicImportSettled();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(analytics.getPostHogAnalyticsConsent()).toBe(false);
  });

  it("honors newly granted consent after revocation during an in-flight import", async () => {
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("lesson_completed");
    analytics.setPostHogAnalyticsConsent(false);
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("diagnostic_started", { source: "new-consent" });
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
    expect(sdk.capture).toHaveBeenCalledExactlyOnceWith("diagnostic_started", {
      source: "new-consent",
    });
  });

  it("contains SDK initialization failure and allows a later retry", async () => {
    const analytics = await load();
    sdk.init.mockImplementationOnce(() => {
      throw new Error("SDK unavailable");
    });
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("lesson_completed");
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
    expect(sdk.capture).not.toHaveBeenCalled();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    analytics.captureApprovedClientEvent("diagnostic_started");
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledWith("diagnostic_started", {}));
    expect(sdk.init).toHaveBeenCalledTimes(2);
  });

  it("opts out immediately after initialization and rejects forbidden properties", async () => {
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
    expect(() =>
      analytics.captureApprovedClientEvent("lesson_completed", { email: "private" }),
    ).toThrow("Forbidden PostHog property");
    analytics.setPostHogAnalyticsConsent(false);
    analytics.captureApprovedClientEvent("lesson_completed");
    expect(sdk.opt_out_capturing).toHaveBeenCalledOnce();
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it("reconciles an SDK stored denial with current consent without an unapproved opt-in event", async () => {
    let denied = true;
    let delivered = 0;
    sdk.opt_in_capturing.mockImplementation(() => {
      denied = false;
    });
    sdk.capture.mockImplementation(() => {
      if (!denied) delivered += 1;
    });
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    await vi.dynamicImportSettled();
    analytics.captureApprovedClientEvent("lesson_completed");
    expect(delivered).toBe(1);
    expect(sdk.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
  });

  it("keeps the SDK denied when reset clears its stored consent", async () => {
    let defaultDenied = false;
    let denied = false;
    sdk.init.mockImplementation(
      (_key: string, options: { opt_out_capturing_by_default: boolean }) => {
        defaultDenied = options.opt_out_capturing_by_default;
        denied = defaultDenied;
      },
    );
    sdk.opt_in_capturing.mockImplementation(() => {
      denied = false;
    });
    sdk.opt_out_capturing.mockImplementation(() => {
      denied = true;
    });
    sdk.reset.mockImplementation(() => {
      denied = defaultDenied;
    });
    const analytics = await load();
    analytics.initPostHogBrowser({ analyticsConsent: true });
    await vi.dynamicImportSettled();
    analytics.resetPostHogBrowser();
    expect(denied).toBe(true);
    expect(analytics.getPostHogAnalyticsConsent()).toBe(false);
  });
});
