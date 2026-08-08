import { describe, expect, it } from "vitest";
import {
  certificateIssueBodySchema,
  certificateRevokeBodySchema,
  certificateTemplateJsonSchema,
  sanitizeCertificateText,
} from "../../../backend/apps/api/src/server/certificates/certificate.dto";
import {
  hashCertificateDesignSnapshot,
  resolveCertificateExpiry,
} from "../../../backend/apps/api/src/server/certificates/certificate-lifecycle";
import { parseCourseCertificateSettings } from "../../../backend/apps/api/src/server/certificates/course-certificate-eligibility";

describe("certificate template JSON safety", () => {
  it("strips html tags from template fields", () => {
    const parsed = certificateTemplateJsonSchema.parse({
      headline: "<script>alert(1)</script>Achievement",
      bodyLines: ["<b>Line</b>"],
    });

    expect(parsed.headline).not.toContain("<");
    expect(parsed.bodyLines[0]).toBe("Line");
  });

  it("rejects unsafe javascript urls in text", () => {
    expect(sanitizeCertificateText("javascript:alert(1)")).toBe("alert(1)");
  });
});

describe("certificate revoke validation", () => {
  it("requires reason and explicit confirmation", () => {
    expect(() =>
      certificateRevokeBodySchema.parse({
        reason: "",
        confirm: true,
      }),
    ).toThrow();

    expect(() =>
      certificateRevokeBodySchema.parse({
        reason: "Compromised credential",
        confirm: false,
      }),
    ).toThrow();
  });
});

describe("certificate issuance lifecycle", () => {
  it("accepts explicit expiration or validity days", () => {
    const base = {
      templateId: "018f0000-0000-7000-8000-000000000001",
      recipientMembershipId: "018f0000-0000-7000-8000-000000000002",
      source: {
        type: "course" as const,
        id: "018f0000-0000-7000-8000-000000000003",
      },
    };

    expect(
      certificateIssueBodySchema.parse({
        ...base,
        expiresAt: "2030-01-01T00:00:00.000Z",
      }).expiresAt,
    ).toBe("2030-01-01T00:00:00.000Z");
    expect(certificateIssueBodySchema.parse({ ...base, validityDays: 365 }).validityDays).toBe(365);
  });

  it("hashes the exact serialized design snapshot", () => {
    expect(hashCertificateDesignSnapshot({ headline: "Achievement", bodyLines: [] })).toBe(
      "dbfdbd248ca71bbacb24e98d1cde9a461f36953af2197efcddbe911ca3ed6476",
    );
  });

  it("prefers explicit expiration and otherwise applies validity days", () => {
    const issuedAt = new Date("2028-01-01T00:00:00.000Z");
    expect(
      resolveCertificateExpiry({
        issuedAt,
        expiresAt: "2029-02-03T04:05:06.000Z",
        validityDays: 30,
      })?.toISOString(),
    ).toBe("2029-02-03T04:05:06.000Z");
    expect(resolveCertificateExpiry({ issuedAt, validityDays: 30 })?.toISOString()).toBe(
      "2028-01-31T00:00:00.000Z",
    );
    expect(resolveCertificateExpiry({ issuedAt }) ?? null).toBeNull();
  });

  it("reads validity days from course certificate configuration", () => {
    const settings = parseCourseCertificateSettings({
      studioFeatures: {
        certificate: true,
        certificateConfiguration: { validityDays: 365 },
      },
    });
    expect(settings.validityDays).toBe(365);
  });
});

describe("certificate outbox payload schemas", () => {
  it("parses issued and revoked payloads", async () => {
    const { certificateIssuedOutboxPayloadSchema, certificateRevokedOutboxPayloadSchema } =
      await import("../../../backend/apps/api/src/server/certificates/certificate.dto");

    expect(
      certificateIssuedOutboxPayloadSchema.parse({
        certificateId: "018f0000-0000-7000-8000-000000000001",
        credentialId: "cred_test",
        templateId: "018f0000-0000-7000-8000-000000000002",
        membershipId: "018f0000-0000-7000-8000-000000000003",
        issuedAt: new Date().toISOString(),
        workflowTransitionId: null,
      }),
    ).toBeTruthy();

    expect(
      certificateRevokedOutboxPayloadSchema.parse({
        certificateId: "018f0000-0000-7000-8000-000000000001",
        credentialId: "cred_test",
        revokedAt: new Date().toISOString(),
      }),
    ).toBeTruthy();
  });
});
