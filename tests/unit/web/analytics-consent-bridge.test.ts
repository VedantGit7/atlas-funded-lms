// @vitest-environment jsdom
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsConsentBridge } from "../../../frontend/apps/web/src/observability/AnalyticsConsentBridge";

const mocks = vi.hoisted(() => ({ get: vi.fn(), consent: vi.fn() }));
vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({ clientApi: { get: mocks.get } }));
vi.mock("../../../frontend/apps/web/src/observability/PostHogProvider", () => ({
  PostHogProvider: ({ analyticsConsent }: { analyticsConsent: boolean }) => {
    mocks.consent(analyticsConsent);
    return null;
  },
}));

// Exercise the renderer installed by the web workspace, which owns React DOM.
const webRequire = createRequire(path.resolve("frontend/apps/web/package.json"));
const { act, createElement, StrictMode } = webRequire("react");
const { createRoot } = webRequire("react-dom/client");
let root: ReturnType<typeof createRoot>;
async function render(hasSession: boolean) {
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(AnalyticsConsentBridge, { hasSession, children: null }),
      ),
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = createRoot(document.createElement("div"));
  mocks.get.mockResolvedValue({ data: { privacy: { analyticsConsent: true } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

describe("optional analytics preferences", () => {
  it("makes no private API requests for anonymous visitors, including strict effect replay", async () => {
    await render(false);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
  });
  it("requires verified opt-in even when a session cookie is present", async () => {
    await render(true);
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/me/preferences");
    expect(mocks.consent.mock.calls[0]).toEqual([false]);
    expect(mocks.consent).toHaveBeenLastCalledWith(true);
  });
  it.each([
    {},
    { privacy: {} },
    { privacy: { analyticsConsent: false } },
    { privacy: { analyticsConsent: "true" } },
  ])("denies analytics without explicit opt-in: %j", async (data) => {
    mocks.get.mockResolvedValue({ data });
    await render(true);
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
  });
  it("denies analytics when an invalid or expired session fails verification", async () => {
    mocks.get.mockRejectedValue(new Error("Unauthorized"));
    await render(true);
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
  });
  it("revokes consent immediately when the session disappears", async () => {
    await render(true);
    mocks.get.mockClear();
    mocks.consent.mockClear();
    await render(false);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.consent.mock.calls.every(([consent]) => consent === false)).toBe(true);
  });
  it("ignores an old in-flight opt-in after the session disappears", async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render(true);
    await render(false);
    await act(async () => resolve({ data: { privacy: { analyticsConsent: true } } }));
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
  });
});
