import { describe, expect, it } from "vitest";
import { updateMarketingCtaDesignBodySchema } from "../../../backend/apps/api/src/server/marketing-cta/marketing-cta.schemas";
import {
  ctaLinkLabel,
  isValidCtaLink,
} from "../../../frontend/apps/web/src/features/admin/grow/cta-shared";
import { formatEventWhen } from "../../../frontend/apps/web/src/features/admin/grow/events-shared";
import {
  answerDisplayValue,
  FORM_FIELD_TYPE_OPTIONS,
  isChoiceFieldType,
} from "../../../frontend/apps/web/src/features/admin/grow/forms-shared";

const design = {
  headline: "Join",
  buttonText: "Go",
  buttonColor: "#000000",
  buttonTextColor: "#ffffff",
  backgroundColor: "#ffffff",
};

describe("CTA links (QA review 2 H31)", () => {
  it.each(["/courses", "/p/home?ref=banner", "https://example.com/offer", "http://example.com"])(
    "accepts %s",
    (link) => {
      expect(isValidCtaLink(link)).toBe(true);
      expect(
        updateMarketingCtaDesignBodySchema.safeParse({ ...design, linkUrl: link }).success,
      ).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "//evil.example.com",
    "/\\evil.example.com",
    "courses",
    "ftp://x.y",
  ])("refuses %s", (link) => {
    expect(isValidCtaLink(link)).toBe(false);
    expect(updateMarketingCtaDesignBodySchema.safeParse({ ...design, linkUrl: link }).success).toBe(
      false,
    );
  });

  it("still lets the link be left empty", () => {
    expect(updateMarketingCtaDesignBodySchema.safeParse({ ...design, linkUrl: "" }).success).toBe(
      true,
    );
    expect(updateMarketingCtaDesignBodySchema.safeParse({ ...design, linkUrl: null }).success).toBe(
      true,
    );
  });

  it("only calls the link optional where it is", () => {
    expect(ctaLinkLabel("STICKY")).toBe("Link");
    expect(ctaLinkLabel("SLIDE_IN")).toBe("Link");
    expect(ctaLinkLabel("POPUP")).toBe("Link (optional)");
    expect(ctaLinkLabel("EMBEDDED_BUTTON")).toBe("Link (optional)");
  });
});

describe("form fields (QA review 2 H30)", () => {
  it("offers choice, date and consent fields, and no password", () => {
    const types = FORM_FIELD_TYPE_OPTIONS.map((option) => option.value);
    expect(types).toEqual(
      expect.arrayContaining(["select", "radio", "checkboxes", "date", "consent"]),
    );
    expect(types).not.toContain("password");
    expect(isChoiceFieldType("checkboxes")).toBe(true);
    expect(isChoiceFieldType("date")).toBe(false);
  });

  it("shows checkbox and consent answers in words", () => {
    expect(answerDisplayValue(["FX", "Futures"])).toBe("FX, Futures");
    expect(answerDisplayValue([])).toBe("—");
    expect(answerDisplayValue(true)).toBe("Yes");
    expect(answerDisplayValue(false)).toBe("No");
  });
});

describe("event page time (QA review 2 H29)", () => {
  it("shows the academy's zone by name", () => {
    const label = formatEventWhen(
      "2026-12-01T13:00:00.000Z",
      "2026-12-01T14:30:00.000Z",
      "Asia/Kolkata",
    );
    expect(label).toContain("India Standard Time");
    expect(label).toMatch(/6:30/);
    expect(label).toMatch(/8:00/);
  });

  it("falls back to the reader's zone for an unknown one, and still names it", () => {
    expect(formatEventWhen("2026-12-01T13:00:00.000Z", null, "Mars/Olympus")).toMatch(/\(.+\)$/);
  });
});
