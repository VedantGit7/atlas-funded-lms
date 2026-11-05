import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore } from "../../../backend/packages/api/src/rate-limit-store";
import { enforceMfaAttemptRateLimit } from "../../../backend/packages/api/src/rate-limit";
import { setRateLimitStore } from "../../../backend/packages/api/src/rate-limit-store";

/**
 * The authenticator-code routes are rate limited per member (audit H4). Step-up
 * itself is in tests/integration/auth/better-auth-two-factor.test.ts.
 */
describe("enforceMfaAttemptRateLimit", () => {
  it("allows ten attempts per member in fifteen minutes, then refuses", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const attempt = (actorId: string) =>
      enforceMfaAttemptRateLimit({ tenantId: "tenant-1", actorId, requestId: "r" });
    for (let index = 0; index < 10; index += 1)
      await expect(attempt("member-1")).resolves.toBeUndefined();
    await expect(attempt("member-1")).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    // Another member's budget is untouched.
    await expect(attempt("member-2")).resolves.toBeUndefined();
    setRateLimitStore(null);
  });
});
