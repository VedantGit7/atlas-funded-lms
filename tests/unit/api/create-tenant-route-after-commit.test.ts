import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTenantRoute } from "@atlas/api";

/**
 * afterCommit runs once per request, after the handler's transaction. An
 * idempotent replay returns the stored handler result, so pairing the two
 * would run the step again on every retry: the route refuses that at definition.
 */
const metadata = {
  permission: "certificate.read",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
} as const;

describe("createTenantRoute afterCommit", () => {
  it("refuses afterCommit on an idempotent route", () => {
    expect(() =>
      createTenantRoute({
        metadata: { ...metadata, idempotency: "required" },
        output: z.unknown(),
        handler: async () => ({}),
        afterCommit: async ({ result }) => result,
      }),
    ).toThrow(/afterCommit cannot be combined with idempotency/);
  });

  it("accepts afterCommit where requests are not replayed", () => {
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
