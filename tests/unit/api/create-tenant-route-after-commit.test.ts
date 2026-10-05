import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTenantRoute } from "@atlas/api";

/**
 * afterCommit runs once per request, after the handler's transaction. An
 * idempotent replay returns the stored handler result and runs it again, so an
 * idempotent route must declare that its afterCommit is itself idempotent.
 */
const metadata = {
  permission: "certificate.read",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
} as const;

describe("createTenantRoute afterCommit", () => {
  it("refuses afterCommit on an idempotent route that does not declare it replay-safe", () => {
    expect(() =>
      createTenantRoute({
        metadata: { ...metadata, idempotency: "required" },
        output: z.unknown(),
        handler: async () => ({}),
        afterCommit: async ({ result }) => result,
      }),
    ).toThrow(/afterCommitIsIdempotent/);
  });

  it("accepts it on an idempotent route that declares it replay-safe", () => {
    expect(() =>
      createTenantRoute({
        metadata: { ...metadata, idempotency: "required" },
        output: z.unknown(),
        handler: async () => ({}),
        afterCommit: async ({ result }) => result,
        afterCommitIsIdempotent: true,
      }),
    ).not.toThrow();
  });

  it("accepts it where requests are not replayed", () => {
    expect(() =>
      createTenantRoute({
        metadata: { ...metadata, idempotency: "none" },
        output: z.unknown(),
        handler: async () => ({}),
        afterCommit: async ({ result }) => result,
      }),
    ).not.toThrow();
  });
});
