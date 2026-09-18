import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * A route's failure log must name the same error code the route responds with.
 *
 * It did not. The classifier read `error.code`, which a Zod failure does not
 * carry, so every malformed request across the API was logged as
 * `INTERNAL_ERROR` while correctly answering `400 VALIDATION_ERROR` — ordinary
 * client input, counted against the server error budget on every log-based
 * dashboard and alert. Sentry was unaffected: `isExpectedClientError` already
 * special-cased `ZodError`, which is exactly the drift these tests pin down.
 */

const { infoMock, errorMock } = vi.hoisted(() => ({
  infoMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("../../../backend/packages/observability/src/logger", () => ({
  structuredLogger: {
    info: (...args: unknown[]) => infoMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const { classifyRouteErrorCode, runRouteLifecycle } =
  await import("../../../backend/packages/observability/src/route-lifecycle");

const { isExpectedClientError } =
  await import("../../../backend/packages/observability/src/sentry/expected-errors");

function zodError(): unknown {
  try {
    z.object({ a: z.string() }).strict().parse({ a: 1 });
  } catch (caught) {
    return caught;
  }
  throw new Error("expected a ZodError");
}

class CodedError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function loggedErrorCode(): string {
  const [fields] = errorMock.mock.calls[0] as [{ message: string; errorCode: string }];
  expect(fields.message).toBe("route.failure");
  return fields.errorCode;
}

async function runFailing(error: unknown, classifyError?: (error: unknown) => string) {
  await expect(
    runRouteLifecycle(
      {
        requestId: "req-1",
        route: "/api/v1/things",
        ...(classifyError ? { classifyError } : {}),
      },
      () => Promise.reject(error),
    ),
  ).rejects.toBe(error);
}

describe("classifyRouteErrorCode", () => {
  it("reports a Zod failure as the client validation error it answers with", () => {
    expect(classifyRouteErrorCode(zodError())).toBe("VALIDATION_ERROR");
  });

  it("prefers an explicit error code when the error carries one", () => {
    expect(classifyRouteErrorCode(new CodedError("PERMISSION_DENIED"))).toBe("PERMISSION_DENIED");
  });

  it("still reports a genuine fault as INTERNAL_ERROR", () => {
    expect(classifyRouteErrorCode(new Error("boom"))).toBe("INTERNAL_ERROR");
    expect(classifyRouteErrorCode("not even an error")).toBe("INTERNAL_ERROR");
  });

  it("agrees with the Sentry filter on what counts as a client error", () => {
    // The two answered differently before, which is how the drift went unnoticed:
    // Sentry stayed quiet while the logs shouted INTERNAL_ERROR.
    const validation = zodError();
    expect(isExpectedClientError(validation)).toBe(true);
    expect(classifyRouteErrorCode(validation)).toBe("VALIDATION_ERROR");

    const fault = new Error("boom");
    expect(isExpectedClientError(fault)).toBe(false);
    expect(classifyRouteErrorCode(fault)).toBe("INTERNAL_ERROR");
  });
});

describe("runRouteLifecycle failure logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs a validation failure as VALIDATION_ERROR, not INTERNAL_ERROR", async () => {
    await runFailing(zodError());
    expect(loggedErrorCode()).toBe("VALIDATION_ERROR");
  });

  it("logs a coded error under its own code", async () => {
    await runFailing(new CodedError("PERMISSION_DENIED"));
    expect(loggedErrorCode()).toBe("PERMISSION_DENIED");
  });

  it("logs an unexpected fault as INTERNAL_ERROR", async () => {
    await runFailing(new Error("boom"));
    expect(loggedErrorCode()).toBe("INTERNAL_ERROR");
  });

  it("lets the caller's envelope classifier win, so log and response agree", async () => {
    // Route factories pass the same envelope they respond with — including cases
    // the standalone fallback cannot see, such as the storage-message mapping.
    await runFailing(new Error("UNSUPPORTED_LESSON_ASSET_TYPE"), () => "VALIDATION_ERROR");
    expect(loggedErrorCode()).toBe("VALIDATION_ERROR");
  });

  it("still logs route.start and rethrows for the factory to answer", async () => {
    await runFailing(new Error("boom"));
    const [startFields] = infoMock.mock.calls[0] as [{ message: string }];
    expect(startFields.message).toBe("route.start");
  });
});
