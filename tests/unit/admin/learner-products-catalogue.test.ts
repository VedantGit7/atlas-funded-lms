import { describe, expect, it } from "vitest";
import { slugifyTitle } from "../../../frontend/apps/web/src/features/admin/learner-products/learner-products-api";
import {
  formatUpdatedAt,
  itemKindLabel,
  statusChipClassName,
  statusLabel,
  toCsv,
} from "../../../frontend/apps/web/src/features/admin/learner-products/learner-products-shared";
import {
  LEARNER_PRODUCT_KINDS,
  updateLearnerProductStatusBodySchema,
} from "../../../backend/packages/domain/src/learner-products/learner-products.dto";

describe("learner product catalogue presentation", () => {
  it("tones the status chip by publish state without hardcoding colours", () => {
    expect(statusChipClassName("PUBLISHED")).toContain("--admin-success");
    expect(statusChipClassName("DRAFT")).toContain("--admin-surface-high");
    expect(statusChipClassName("ARCHIVED")).toContain("--admin-on-surface");
    for (const status of ["PUBLISHED", "DRAFT", "ARCHIVED"]) {
      expect(statusChipClassName(status)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it("titlecases the API status without mutating the wire value", () => {
    expect(statusLabel("PUBLISHED")).toBe("Published");
    expect(statusLabel("ARCHIVED")).toBe("Archived");
  });

  it("renders item kinds as prose", () => {
    expect(itemKindLabel("mock_test")).toBe("Mock test");
    expect(itemKindLabel("course")).toBe("Course");
  });

  it("formats updated timestamps to a fixed-width day and survives bad input", () => {
    expect(formatUpdatedAt("2026-08-23T11:22:33.000Z")).toBe("2026-08-23");
    expect(formatUpdatedAt("not-a-date")).toBe("—");
  });

  it("escapes quotes and commas so an export cannot shift columns", () => {
    const csv = toCsv(["Title", "Slug"], [['Risk desk, "final"', "risk-desk-final"]]);
    // The shared escaper quotes only cells that need it, per RFC 4180.
    expect(csv).toBe('Title,Slug\r\n"Risk desk, ""final""",risk-desk-final');
  });

  it("neutralises a tenant-authored title that a spreadsheet would run as a formula", () => {
    // The reader is an admin opening this in Excel; quoting alone does not help,
    // because the sheet strips the quotes before evaluating the cell.
    const csv = toCsv(["Title"], [['=HYPERLINK("https://evil.test","Click")']]);
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).not.toContain("\r\n=HYPERLINK");
  });

  it("leaves a negative number numeric rather than guarding it into text", () => {
    expect(toCsv(["Delta"], [["-12.5"]])).toBe("Delta\r\n-12.5");
  });
});

describe("learner product status transition contract", () => {
  const productId = "018f0000-0000-7000-8000-0000000000a1";

  it("accepts each publish state for a set of products", () => {
    for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
      expect(
        updateLearnerProductStatusBodySchema.parse({
          productKind: "bundle",
          productIds: [productId],
          status,
        }),
      ).toEqual({ productKind: "bundle", productIds: [productId], status });
    }
  });

  it("accepts every product kind the catalogue lists", () => {
    for (const productKind of LEARNER_PRODUCT_KINDS) {
      expect(() =>
        updateLearnerProductStatusBodySchema.parse({
          productKind,
          productIds: [productId],
          status: "PUBLISHED",
        }),
      ).not.toThrow();
    }
  });

  it("rejects unknown states, unknown kinds and smuggled catalogue edits", () => {
    const rejected = [
      { productKind: "bundle", productIds: [productId], status: "LIVE" },
      { productKind: "course", productIds: [productId], status: "PUBLISHED" },
      { productKind: "bundle", productIds: [], status: "PUBLISHED" },
      { productKind: "bundle", productIds: ["not-a-uuid"], status: "PUBLISHED" },
      { productKind: "bundle", productIds: [productId], status: "PUBLISHED", slug: "renamed" },
    ];

    for (const body of rejected) {
      expect(() => updateLearnerProductStatusBodySchema.parse(body)).toThrow();
    }
  });
});

describe("slug derivation", () => {
  it("turns a title into a URL-safe slug", () => {
    expect(slugifyTitle("Complete Trader Bundle")).toBe("complete-trader-bundle");
    expect(slugifyTitle("  Risk desk: mock #2  ")).toBe("risk-desk-mock-2");
  });

  it("collapses punctuation runs rather than leaving empty segments", () => {
    expect(slugifyTitle("A — B / C")).toBe("a-b-c");
    expect(slugifyTitle("!!!")).toBe("");
  });

  it("stays inside the 128 characters the API accepts", () => {
    // A title longer than the column would otherwise produce a slug the server
    // rejects only on submit, after the whole form is filled in.
    expect(slugifyTitle("a".repeat(400))).toHaveLength(128);
  });
});
