import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * `GET /api/v1/public/bootstrap` publishes the tenant's support address so
 * public screens (verify-email, password reset) can offer a route to help
 * without falling back to another tenant's contact details.
 *
 * The response schema requires a *valid* address, and this route backs every
 * page in the app. The address comes from operator-supplied tenant config
 * (`channels.supportEmail.fromEmail`), so a single typo there must degrade to
 * "no support address" rather than throw at the response boundary and 500 the
 * entire tenant. The route validates before assembling the response; these
 * tests pin that ordering.
 */

/** Mirrors the resolution in the bootstrap route. */
function resolveSupportEmail(configured: string): string | null {
  return z.email().safeParse(configured.trim()).data ?? null;
}

/** Mirrors the `supportEmail` field of the bootstrap response schema. */
const responseFieldSchema = z.object({ supportEmail: z.email().nullable() });

describe("public bootstrap support email", () => {
  it("publishes a valid configured address", () => {
    expect(resolveSupportEmail("help@academy.test")).toBe("help@academy.test");
    expect(resolveSupportEmail("  help@academy.test  ")).toBe("help@academy.test");
  });

  it("treats an unconfigured channel as no address", () => {
    // An unset channel reads as an empty string, not null.
    expect(resolveSupportEmail("")).toBeNull();
    expect(resolveSupportEmail("   ")).toBeNull();
  });

  it("degrades a malformed address instead of failing the response", () => {
    for (const malformed of ["not-an-email", "a@b", "Help <help@x.com>", "@nope.com"]) {
      const resolved = resolveSupportEmail(malformed);
      expect(resolved, `${malformed} must not be published`).toBeNull();
      // The critical property: whatever resolution produces must satisfy the
      // response schema, because a throw here takes down every page.
      expect(() => responseFieldSchema.parse({ supportEmail: resolved })).not.toThrow();
    }
  });

  it("would fail the response schema if a raw value were passed through", () => {
    // Positive control: proves the test above is actually guarding something.
    expect(() => responseFieldSchema.parse({ supportEmail: "not-an-email" })).toThrow();
  });
});
