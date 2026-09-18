import { describe, expect, it } from "vitest";
import {
  INVOICE_PREFIX_MAX_LENGTH as SERVER_MAX,
  INVOICE_PREFIX_PATTERN as SERVER_PATTERN,
  UpdateInvoiceRequestSchema,
  formatInvoiceNumber as serverFormat,
} from "../../../backend/packages/domain/config/src/schemas/learner-billing";
import {
  INVOICE_PREFIX_MAX_LENGTH,
  INVOICE_PREFIX_PATTERN,
  formatInvoiceNumber,
  parseSequence,
  sanitiseInvoicePrefix,
  validateInvoice,
} from "../../../frontend/apps/web/src/features/admin/learner-billing/invoice-shared";

/**
 * Invoice numbering.
 *
 * The screen's preview is only worth showing if it matches what
 * `allocateInvoiceNumber` produces. It used to concatenate the two fields and
 * render "INV-1"; the allocator inserts its own hyphen and pads to five digits,
 * so that number could never appear on an invoice.
 */

describe("formatInvoiceNumber matches the allocator", () => {
  it("inserts the separating hyphen and pads to five digits", () => {
    // allocateInvoiceNumber: `${prefix}-${String(n).padStart(5, "0")}`.
    expect(formatInvoiceNumber("INV", 1)).toBe("INV-00001");
    expect(formatInvoiceNumber("INV", 42)).toBe("INV-00042");
  });

  it("shows the double hyphen a trailing-hyphen prefix really produces", () => {
    // The mistake the field's hint now warns about.
    expect(formatInvoiceNumber("INV-", 1)).toBe("INV--00001");
  });

  it("stops padding once the sequence outgrows five digits", () => {
    expect(formatInvoiceNumber("INV", 123_456)).toBe("INV-123456");
  });

  it("agrees with the server copy", () => {
    for (const [prefix, sequence] of [
      ["INV", 1],
      ["INV-", 7],
      ["ACME_2026", 99_999],
      ["X", 100_000],
    ] as const) {
      expect(formatInvoiceNumber(prefix, sequence)).toBe(serverFormat(prefix, sequence));
    }
  });
});

describe("the prefix rules match the allocator's own filter", () => {
  it("uses the server's pattern and length", () => {
    expect(INVOICE_PREFIX_PATTERN.source).toBe(SERVER_PATTERN.source);
    expect(INVOICE_PREFIX_PATTERN.flags).toBe(SERVER_PATTERN.flags);
    expect(INVOICE_PREFIX_MAX_LENGTH).toBe(SERVER_MAX);
  });

  it("rejects characters the allocator would strip", () => {
    // Previously "ACME Ltd." saved happily and was printed as "ACMELtd".
    expect(UpdateInvoiceRequestSchema.safeParse(request({ prefix: "ACME Ltd." })).success).toBe(
      false,
    );
    expect(validateInvoice(draft({ prefix: "ACME Ltd." })).prefix).toBeDefined();
  });

  it("rejects a prefix longer than the allocator keeps", () => {
    // 20 characters passed the old schema and was then cut to 16.
    const long = "A".repeat(20);
    expect(UpdateInvoiceRequestSchema.safeParse(request({ prefix: long })).success).toBe(false);
    expect(validateInvoice(draft({ prefix: long })).prefix).toBeDefined();
  });

  it("accepts one of exactly the maximum length", () => {
    const exact = "A".repeat(INVOICE_PREFIX_MAX_LENGTH);
    expect(UpdateInvoiceRequestSchema.safeParse(request({ prefix: exact })).success).toBe(true);
    expect(validateInvoice(draft({ prefix: exact })).prefix).toBeUndefined();
  });

  it("accepts hyphens and underscores", () => {
    expect(UpdateInvoiceRequestSchema.safeParse(request({ prefix: "ACME_IN-2026" })).success).toBe(
      true,
    );
  });

  it("rejects an empty prefix", () => {
    expect(UpdateInvoiceRequestSchema.safeParse(request({ prefix: "   " })).success).toBe(false);
    expect(validateInvoice(draft({ prefix: "   " })).prefix).toBeDefined();
  });
});

describe("sanitiseInvoicePrefix shows what would survive", () => {
  it("strips the characters the allocator drops", () => {
    expect(sanitiseInvoicePrefix("ACME Ltd.")).toBe("ACMELtd");
  });

  it("cuts to the allocator's limit", () => {
    expect(sanitiseInvoicePrefix("A".repeat(30))).toHaveLength(INVOICE_PREFIX_MAX_LENGTH);
  });

  it("can come back empty, which is why the field rejects rather than rewrites", () => {
    expect(sanitiseInvoicePrefix("!!!")).toBe("");
  });
});

describe("validateInvoice agrees with the server", () => {
  it("reaches the same verdict on each candidate", () => {
    const drafts = [
      { businessName: "Atlas", prefix: "INV", nextNumber: "1" },
      { businessName: "", prefix: "INV", nextNumber: "1" },
      { businessName: "Atlas", prefix: "IN V", nextNumber: "1" },
      { businessName: "Atlas", prefix: "INV", nextNumber: "0" },
      { businessName: "Atlas", prefix: "INV", nextNumber: "" },
      { businessName: "Atlas", prefix: "A".repeat(20), nextNumber: "5" },
    ];
    for (const candidate of drafts) {
      const clientOk = Object.keys(validateInvoice(candidate)).length === 0;
      const serverOk = UpdateInvoiceRequestSchema.safeParse({
        businessName: candidate.businessName,
        prefix: candidate.prefix,
        nextNumber: parseSequence(candidate.nextNumber) ?? Number.NaN,
      }).success;
      expect([candidate, clientOk]).toEqual([candidate, serverOk]);
    }
  });

  it("rejects a fractional next number", () => {
    // The counter is an integer column; 1.5 would round somewhere invisible.
    expect(validateInvoice(draft({ nextNumber: "1.5" })).nextNumber).toBeDefined();
    expect(UpdateInvoiceRequestSchema.safeParse(request({ nextNumber: 1.5 })).success).toBe(false);
  });

  it("rejects a next number below one", () => {
    expect(validateInvoice(draft({ nextNumber: "0" })).nextNumber).toBeDefined();
  });
});

describe("parseSequence", () => {
  it("reads a blank field as unset rather than zero", () => {
    expect(parseSequence("")).toBeNull();
    expect(parseSequence("  ")).toBeNull();
  });

  it("rejects a fractional value", () => {
    expect(parseSequence("2.5")).toBeNull();
  });

  it("reads a whole number", () => {
    expect(parseSequence(" 128 ")).toBe(128);
  });
});

function draft(overrides: Partial<{ businessName: string; prefix: string; nextNumber: string }>) {
  return { businessName: "Atlas", prefix: "INV", nextNumber: "1", ...overrides };
}

function request(overrides: Partial<{ businessName: string; prefix: string; nextNumber: number }>) {
  return { businessName: "Atlas", prefix: "INV", nextNumber: 1, ...overrides };
}
