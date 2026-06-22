import { describe, expect, it } from "vitest";
import { validateProductionObservabilityEnv } from "@atlas/observability/env";
import { createWorkerObservabilityContext } from "@atlas/observability/worker/context";
import { isExpectedClientError } from "@atlas/observability/sentry/expected-errors";
import { AtlasHttpError } from "@atlas/core/http/errors";

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
});
