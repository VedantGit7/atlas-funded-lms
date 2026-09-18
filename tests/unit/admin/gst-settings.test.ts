import { describe, expect, it } from "vitest";
import {
  GSTIN_PATTERN as SERVER_PATTERN,
  UpdateGstRequestSchema,
  hasValidGstinChecksum as serverChecksum,
  isValidGstin as serverIsValidGstin,
} from "../../../backend/packages/domain/config/src/schemas/learner-billing";
import {
  GSTIN_PATTERN,
  hasValidGstinChecksum,
  isValidGstin,
  parsePercentage,
  taxCents,
  validateGst,
} from "../../../frontend/apps/web/src/features/admin/learner-billing/gst-shared";

/**
 * GST settings.
 *
 * Two rules are duplicated on purpose — the GSTIN check, so a typo is caught
 * without a round trip, and the tax arithmetic, so the screen's worked example
 * matches what checkout charges. The point of this file is that the copies stay
 * in step with their originals.
 */

// A real-shaped GSTIN with a correct check digit (state 27, PAN ABCDE1234F).
const VALID_GSTIN = "27ABCDE1234F1Z0";

describe("GSTIN validation", () => {
  it("accepts a well-formed number", () => {
    expect(isValidGstin(VALID_GSTIN)).toBe(true);
  });

  it("upper-cases and trims before checking", () => {
    expect(isValidGstin(`  ${VALID_GSTIN.toLowerCase()}  `)).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidGstin(VALID_GSTIN.slice(0, 14))).toBe(false);
    expect(isValidGstin(`${VALID_GSTIN}0`)).toBe(false);
  });

  it("rejects a number that does not have Z in the fourteenth position", () => {
    expect(isValidGstin("27ABCDE1234F1A0")).toBe(false);
  });

  it("rejects a wrong check digit, which the pattern alone accepts", () => {
    // The whole reason for computing the checksum: this passes the regex.
    const wrongDigit = `${VALID_GSTIN.slice(0, 14)}5`;
    expect(GSTIN_PATTERN.test(wrongDigit)).toBe(true);
    expect(isValidGstin(wrongDigit)).toBe(false);
  });

  it("rejects a transposed pair", () => {
    // A regex cannot see this; an invoice carrying it is unclaimable.
    const transposed = `27ABCDE1243F1Z0`;
    expect(GSTIN_PATTERN.test(transposed)).toBe(true);
    expect(isValidGstin(transposed)).toBe(false);
  });

  it("rejects free text", () => {
    expect(isValidGstin("not a gstin")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
});

describe("the client copy agrees with the server", () => {
  it("uses the same pattern", () => {
    expect(GSTIN_PATTERN.source).toBe(SERVER_PATTERN.source);
    expect(GSTIN_PATTERN.flags).toBe(SERVER_PATTERN.flags);
  });

  it("reaches the same verdict on every candidate", () => {
    const candidates = [
      VALID_GSTIN,
      VALID_GSTIN.toLowerCase(),
      `${VALID_GSTIN.slice(0, 14)}5`,
      "27ABCDE1243F1Z0",
      "27ABCDE1234F1A0",
      "07AAACT2727Q1ZS",
      "",
      "   ",
      "not a gstin",
      "999999999999999",
    ];
    for (const candidate of candidates) {
      expect([candidate, isValidGstin(candidate)]).toEqual([
        candidate,
        serverIsValidGstin(candidate),
      ]);
      expect(hasValidGstinChecksum(candidate)).toBe(serverChecksum(candidate));
    }
  });
});

describe("enabling GST requires the fields that make it work", () => {
  it("rejects enabling with nothing filled in", () => {
    // The bug this closes: the flag went true, checkout added 0%, and the
    // invoice carried no GSTIN.
    const result = UpdateGstRequestSchema.safeParse({
      enabled: true,
      number: null,
      percentage: null,
    });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("number");
    expect(paths).toContain("percentage");
  });

  it("rejects enabling with an invalid GSTIN", () => {
    const result = UpdateGstRequestSchema.safeParse({
      enabled: true,
      number: `${VALID_GSTIN.slice(0, 14)}5`,
      percentage: 18,
    });
    expect(result.success).toBe(false);
  });

  it("rejects enabling at zero percent, which charges nothing", () => {
    const result = UpdateGstRequestSchema.safeParse({
      enabled: true,
      number: VALID_GSTIN,
      percentage: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully configured request and stores the number upper-cased", () => {
    const result = UpdateGstRequestSchema.safeParse({
      enabled: true,
      number: ` ${VALID_GSTIN.toLowerCase()} `,
      percentage: 18,
    });
    expect(result.success).toBe(true);
    expect(result.success ? result.data.number : null).toBe(VALID_GSTIN);
  });

  it("leaves a disabled config alone", () => {
    // Turning GST off must not be blocked by fields that are no longer in use.
    const result = UpdateGstRequestSchema.safeParse({
      enabled: false,
      number: null,
      percentage: null,
    });
    expect(result.success).toBe(true);
  });

  it("still rejects a percentage outside the allowed range", () => {
    expect(
      UpdateGstRequestSchema.safeParse({ enabled: true, number: VALID_GSTIN, percentage: 120 })
        .success,
    ).toBe(false);
  });
});

describe("validateGst mirrors those conditions client-side", () => {
  it("flags both fields when enabling empty", () => {
    const errors = validateGst({ enabled: true, number: "", percentage: "" });
    expect(errors.number).toBeDefined();
    expect(errors.percentage).toBeDefined();
  });

  it("flags a bad check digit", () => {
    const errors = validateGst({
      enabled: true,
      number: `${VALID_GSTIN.slice(0, 14)}5`,
      percentage: "18",
    });
    expect(errors.number).toBeDefined();
  });

  it("flags zero percent", () => {
    expect(
      validateGst({ enabled: true, number: VALID_GSTIN, percentage: "0" }).percentage,
    ).toBeDefined();
  });

  it("raises nothing while GST is off", () => {
    expect(validateGst({ enabled: false, number: "rubbish", percentage: "abc" })).toEqual({});
  });

  it("accepts a valid pair", () => {
    expect(validateGst({ enabled: true, number: VALID_GSTIN, percentage: "18" })).toEqual({});
  });

  it("agrees with the server on the same input", () => {
    for (const draft of [
      { enabled: true, number: "", percentage: "" },
      { enabled: true, number: VALID_GSTIN, percentage: "0" },
      { enabled: true, number: VALID_GSTIN, percentage: "18" },
      { enabled: false, number: "", percentage: "" },
    ]) {
      const clientOk = Object.keys(validateGst(draft)).length === 0;
      const serverOk = UpdateGstRequestSchema.safeParse({
        enabled: draft.enabled,
        number: draft.number === "" ? null : draft.number,
        percentage: parsePercentage(draft.percentage),
      }).success;
      expect([draft, clientOk]).toEqual([draft, serverOk]);
    }
  });
});

describe("parsePercentage", () => {
  it("reads a blank field as unset rather than zero", () => {
    // Parsing "" as 0 would silently save a rate that charges nothing.
    expect(parsePercentage("")).toBeNull();
    expect(parsePercentage("   ")).toBeNull();
  });

  it("reads a stray character as unset", () => {
    expect(parsePercentage("18%")).toBeNull();
  });

  it("reads a decimal rate", () => {
    expect(parsePercentage("12.5")).toBe(12.5);
  });
});

describe("taxCents matches the checkout arithmetic", () => {
  it("applies the rate and rounds the same way", () => {
    // computeTaxCents in sales-coupons.service.ts: round(amount * pct / 100).
    expect(taxCents(100_000, 18)).toBe(18_000);
    expect(taxCents(99_999, 18)).toBe(Math.round((99_999 * 18) / 100));
  });

  it("charges nothing at zero or below, exactly as checkout does", () => {
    expect(taxCents(100_000, 0)).toBe(0);
    expect(taxCents(100_000, -5)).toBe(0);
    expect(taxCents(100_000, null)).toBe(0);
  });

  it("rounds a fractional slab to the nearest paisa", () => {
    expect(taxCents(1_050, 12.5)).toBe(131);
  });
});
