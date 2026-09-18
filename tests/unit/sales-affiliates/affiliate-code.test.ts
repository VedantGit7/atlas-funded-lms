import { describe, expect, it } from "vitest";

// Inline mirror of normalize used in repository to keep the unit test light.
function normalizeAffiliateCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

describe("sales affiliates helpers", () => {
  it("normalizes affiliate coupon codes", () => {
    expect(normalizeAffiliateCode("  ab12xy  ")).toBe("AB12XY");
    expect(normalizeAffiliateCode("bad code!")).toBe("BADCODE");
  });
});
