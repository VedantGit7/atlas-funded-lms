import { describe, expect, it } from "vitest";
import { validateProductionObservabilityEnv } from "@atlas/observability/env";
import { createWorkerObservabilityContext } from "@atlas/observability/worker/context";
import { isExpectedClientError } from "@atlas/observability/sentry/expected-errors";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { EntitlementRequiredError } from "@atlas/authorization";

describe("observability env and worker context", () => {
  it("requires hash salt in production", () => {
    const result = validateProductionObservabilityEnv({
      APP_ENV: "production",
      NODE_ENV: "production",
    });
    expect(result.ok).toBe(false);
  });

  it("creates independent worker request ids", () => {
    const first = createWorkerObservabilityContext({
      parentRequestId: "req_00000000-0000-4000-8000-000000000010",
      jobName: "search-outbox",
    });
    const second = createWorkerObservabilityContext({
      parentRequestId: "req_00000000-0000-4000-8000-000000000010",
      jobName: "search-outbox",
    });
    expect(first.workerRequestId).not.toBe(second.workerRequestId);
    expect(first.parentRequestId).toBe(second.parentRequestId);
  });

  it("treats expected auth failures as non-capture errors", () => {
    const error = new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Denied",
    });
    expect(isExpectedClientError(error)).toBe(true);
  });

  // Sentry ATLAS-LMS-5 and -H: refusals whose codes weren't listed.
  it("treats every 4xx refusal as expected, and still reports a 5xx", () => {
    const refusal = (code: string, status: number) =>
      new AtlasHttpError({ code, status, message: code });
    expect(isExpectedClientError(new EntitlementRequiredError("community.enable"))).toBe(true);
    expect(isExpectedClientError(refusal("MFA_REQUIRED", 403))).toBe(true);
    expect(isExpectedClientError(refusal("RATE_LIMITED", 429))).toBe(true);
    expect(isExpectedClientError(refusal("SOMETHING_NEW", 409))).toBe(true);
    expect(isExpectedClientError(refusal("SERVICE_UNAVAILABLE", 503))).toBe(false);
    expect(isExpectedClientError(refusal("INTERNAL_ERROR", 500))).toBe(false);
    expect(isExpectedClientError(new Error("boom"))).toBe(false);
  });
});
