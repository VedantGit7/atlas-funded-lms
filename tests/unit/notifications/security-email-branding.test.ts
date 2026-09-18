import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACADEMY_NAME,
  buildSecurityEmailHtml,
  getBuiltInSecurityTemplate,
} from "../../../backend/apps/api/src/server/notifications/security-notification.templates";

/**
 * Regression tests for two defects in the security email template.
 *
 * 1. White-label leak. The email header and every subject line hardcoded
 *    "FundedBeyond Academy". Atlas is sold to academies, so every tenant's
 *    password-changed and email-changed notifications were branded as tenant #1.
 *
 * 2. Unescaped interpolation. `title`, `body` and `email` were inserted into the
 *    HTML body raw. `title`/`body` come from tenant-admin editable system email
 *    templates and `email` is learner-controlled, so either could inject markup
 *    into a security email delivered to someone else.
 *
 * The brand name appears below only inside `not.toContain` assertions — proving
 * it is ABSENT is the whole point of the file, so atlas/no-hardcoded-tenant-strings
 * is disabled here. Keep it to negative assertions; never use it as a fixture value.
 */
/* eslint-disable atlas/no-hardcoded-tenant-strings */

const base = {
  eventType: "security.password_changed" as const,
  email: "learner@example.com",
  siteUrl: "https://academy.example.com",
};

describe("security email branding", () => {
  it("renders the tenant's own name, not FundedBeyond", () => {
    const html = buildSecurityEmailHtml({ ...base, academyName: "Northwind Trading Academy" });

    expect(html).toContain("Northwind Trading Academy");
    expect(html).not.toContain("FundedBeyond");
  });

  it("substitutes the tenant name into the subject placeholder", () => {
    const html = buildSecurityEmailHtml({ ...base, academyName: "Northwind Trading Academy" });

    expect(html).toContain("Your Northwind Trading Academy password was changed");
    expect(html).not.toContain("{{academyName}}");
  });

  it.each([undefined, null, "", "   "])(
    "falls back to a neutral name rather than a brand when publicName is %p",
    (academyName) => {
      const html = buildSecurityEmailHtml({ ...base, academyName });

      expect(html).toContain(DEFAULT_ACADEMY_NAME);
      expect(html).not.toContain("FundedBeyond");
      expect(html).not.toContain("{{academyName}}");
    },
  );

  it("keeps no FundedBeyond string in any built-in subject template", () => {
    for (const key of [
      "security.password_changed",
      "security.email_changed",
      "security.phone_changed",
    ] as const) {
      expect(getBuiltInSecurityTemplate(key).emailSubject).not.toContain("FundedBeyond");
    }
  });
});

describe("security email escaping", () => {
  it("escapes a tenant-controlled academy name", () => {
    const html = buildSecurityEmailHtml({
      ...base,
      academyName: "<script>alert(1)</script>",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes tenant-admin controlled title and body", () => {
    const html = buildSecurityEmailHtml({
      ...base,
      academyName: "Academy",
      title: '<img src=x onerror="alert(1)">',
      body: "<b>bold</b>",
    });

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;img");
  });

  it("escapes the learner-controlled email address", () => {
    const html = buildSecurityEmailHtml({
      ...base,
      academyName: "Academy",
      email: '"><script>alert(1)</script>',
    });

    expect(html).not.toContain("<script>");
  });

  it("leaves the action URL intact", () => {
    const html = buildSecurityEmailHtml({ ...base, academyName: "Academy" });
    expect(html).toContain("https://academy.example.com/reset-password");
  });
});
