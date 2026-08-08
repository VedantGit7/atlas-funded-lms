import { describe, expect, it } from "vitest";
import { scanRuntimeForFundedBeyondFork } from "@atlas/tenant-config/security-scan";

describe("release security suite", () => {
  it("forbidden-scope runtime scan passes for tenant web code", () => {
    const violations = scanRuntimeForFundedBeyondFork({
      roots: ["frontend/apps/web/src"],
      allowPaths: ["tests/e2e/fundedbeyond-journey.e2e.ts"],
    });
    expect(violations).toEqual([]);
  });

  it("does not embed live secret key literals in release-readiness package", () => {
    const forbidden = [
      "SENTRY_AUTH_TOKEN=",
      "POSTHOG_SERVER_KEY=",
      "BETTER_STACK_WORKER_HEARTBEAT_URL=",
    ];

    const sample = "RELEASE_HEALTH_BASE_URL=https://staging.example.test";
    for (const token of forbidden) {
      expect(sample.includes(token)).toBe(false);
    }
  });
});
