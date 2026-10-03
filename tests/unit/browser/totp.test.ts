import { expect, it } from "vitest";
import { totp } from "../../../scripts/e2e/totp.mjs";
it("matches the RFC 6238 SHA-1 vectors with six digits", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  expect(totp(secret, 59000)).toBe("287082");
  expect(totp(secret, 1111111109000)).toBe("081804");
  expect(totp(secret, 2000000000000)).toBe("279037");
});
