import { describe, expect, it } from "vitest";
import {
  certificateRevokeBodySchema,
  certificateTemplateJsonSchema,
  sanitizeCertificateText,
} from "../../../apps/web/src/server/certificates/certificate.dto";

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

describe("certificate outbox payload schemas", () => {
  it("parses issued and revoked payloads", async () => {
    const { certificateIssuedOutboxPayloadSchema, certificateRevokedOutboxPayloadSchema } =
      await import("../../../apps/web/src/server/certificates/certificate.dto");

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
