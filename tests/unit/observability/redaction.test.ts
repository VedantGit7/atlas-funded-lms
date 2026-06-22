import { describe, expect, it } from "vitest";
import { redactObject } from "@atlas/observability/redaction";

describe("redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const output = redactObject({
      requestId: "req_00000000-0000-4000-8000-000000000001",
      authorization: "Bearer secret",
      nested: {
        password: "hidden",
        route: "/api/v1/health",
      },
      signedUrl: "https://example.com/file?X-Amz-Signature=abc",
      databaseUrl: "postgresql://user:pass@localhost/db",
    });

    expect(output.authorization).toBe("[REDACTED]");
    expect((output.nested as Record<string, unknown>).password).toBe("[REDACTED]");
    expect(output.signedUrl).toBe("[REDACTED]");
    expect(output.databaseUrl).toBe("[REDACTED]");
    expect(output.requestId).toBe("req_00000000-0000-4000-8000-000000000001");
  });
});
