import { describe, expect, it } from "vitest";
import {
  generateReferralCodeValue,
  normalizeReferralCode,
} from "../../../backend/apps/api/src/server/sales-referrals/sales-referrals.repository";

describe("sales referrals helpers", () => {
  it("normalizes referral codes to uppercase alphanumerics", () => {
    expect(normalizeReferralCode("  ab-cd12  ")).toBe("AB-CD12");
    expect(normalizeReferralCode("bad code!")).toBe("BADCODE");
  });

  it("generates an 8-character code from the safe alphabet", () => {
    const code = generateReferralCodeValue();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
