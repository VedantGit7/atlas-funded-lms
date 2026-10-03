import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath } from "./split-layout-paths";

describe("observability e2e wiring", () => {
  it("proxy overwrites client request ids", () => {
    // Renamed from middleware.ts in Next 16: same file convention, new name.
    const source = readFileSync(resolveSplitPath("proxy.ts"), "utf8");
    expect(source).toContain("stripClientSuppliedRequestIds");
    expect(source).toContain("createRequestId");
  });

  it("health route uses approved schema imports", () => {
    const source = readFileSync(resolveSplitPath("app/api/v1/health/route.ts"), "utf8");
    expect(source).toContain("healthResponseSchema");
    expect(source).toContain("x-request-id");
  });

  it("posthog browser disables autocapture and replay", () => {
    const source = readFileSync(resolveSplitPath("observability/posthog-browser.ts"), "utf8");
    expect(source).toContain("autocapture: false");
    expect(source).toContain("disable_session_recording: true");
  });

  it("client cache resets posthog on logout and host change", () => {
    const source = readFileSync(resolveSplitPath("lib/query/client-data-cache.ts"), "utf8");
    expect(source).toContain("resetPostHogBrowser");
  });
});
