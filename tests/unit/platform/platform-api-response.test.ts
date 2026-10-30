import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlatformApiError,
  platformApi,
} from "../../../frontend/apps/web/src/features/platform/platform-api";

/**
 * The console reads replies as text first. Parsing a proxy's HTML error page
 * as JSON threw "Unexpected token '<'" and hid the failure (staging, 30
 * October 2026).
 */
function reply(status: number, body: string, contentType: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("platformApi responses", () => {
  it("turns an HTML error page into a readable error", async () => {
    reply(502, "<html><body>Bad gateway</body></html>", "text/html");

    const failure = platformApi.get("/api/v1/platform/tenants", "Review tenants");

    await expect(failure).rejects.toBeInstanceOf(PlatformApiError);
    await expect(failure).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
      message: "The server returned an unexpected error. Check the API logs for details.",
    });
  });

  it("keeps the API's error envelope", async () => {
    reply(
      503,
      JSON.stringify({
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Unable to send the invitation email. Please try again.",
          requestId: "request-id",
        },
      }),
      "application/json",
    );

    await expect(
      platformApi.get("/api/v1/platform/tenants", "Review tenants"),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      requestId: "request-id",
      message: "Unable to send the invitation email. Please try again.",
    });
  });
});
