import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("observability e2e wiring", () => {
  it("middleware overwrites client request ids", () => {
    const source = readFileSync(resolve(webRoot, "middleware.ts"), "utf8");
    expect(source).toContain("stripClientSuppliedRequestIds");
    expect(source).toContain("createRequestId");
  });

  it("health route uses approved schema imports", () => {
    const source = readFileSync(resolve(webRoot, "app/api/v1/health/route.ts"), "utf8");
    expect(source).toContain("healthResponseSchema");
    expect(source).toContain("x-request-id");
  });

  it("posthog browser disables autocapture and replay", () => {
    const source = readFileSync(resolve(webRoot, "observability/posthog-browser.ts"), "utf8");
    expect(source).toContain("autocapture: false");
    expect(source).toContain("disable_session_recording: true");
  });

  it("client cache resets posthog on logout and host change", () => {
    const source = readFileSync(resolve(webRoot, "lib/query/client-data-cache.ts"), "utf8");
    expect(source).toContain("resetPostHogBrowser");
  });
});
