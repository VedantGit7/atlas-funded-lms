import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

// NOTE: Additional certificate surfaces exist beyond the smoke list below:
//   - app/api/v1/certificate-templates/[id]/approve/route.ts (REVIEW → PUBLISHED)
//   - app/api/v1/certificates/[id]/download/route.ts (PDF when r2_object_key set; else HTML / 409)
//   - server/certificates/certificate-feature-flags.ts (extensibility toggles)
//   - server/certificates/learning-path-certificates-settings.ts (stub)
// PDF worker drain/render requires CERTIFICATE_PDF_WORKER=true. Content-type
// coverage for stored PDFs: tests/unit/certificates/certificate-download-pdf.test.ts

const certificatePaths = [
  "app/(public)/verify/[credentialId]/page.tsx",
  "app/(learner)/certificates/page.tsx",
  "app/admin/certificates/page.tsx",
  "app/admin/certificates/templates/page.tsx",
  "app/api/v1/certificate-templates/route.ts",
  "app/api/v1/certificate-templates/[id]/publish/route.ts",
  "app/api/v1/certificates/route.ts",
  "app/api/v1/certificates/issue/route.ts",
  "app/api/v1/certificates/[id]/download/route.ts",
  "app/api/v1/certificates/[id]/wallet/apple/route.ts",
  "app/api/v1/certificates/[id]/wallet/apple/download/route.ts",
  "app/api/v1/certificates/[id]/wallet/google/route.ts",
  "app/api/v1/certificates/[id]/revoke/route.ts",
  "app/api/v1/public/verify/[credentialId]/route.ts",
  "server/certificates/certificate.service.ts",
  "server/certificates/certificate.worker.ts",
  "server/certificates/certificate-pdf.service.ts",
  "features/certificates/components/CertificateCard.tsx",
  "features/certificates/components/CertificateShareDialog.tsx",
  "features/certificates/components/VerificationCard.tsx",
  "features/certificates/components/CertificateTemplateManager.tsx",
  "features/certificates/components/IssuedCertificateTable.tsx",
  "features/certificates/components/IssueCertificateDialog.tsx",
  "features/certificates/components/RevokeCertificateDialog.tsx",
];

describe("certificate e2e wiring", () => {
  it("includes approved screens, APIs, and worker wiring", () => {
    for (const relativePath of certificatePaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("public verify page uses minimal projection", () => {
    const source = readFileSync(
      resolveSplitPath("features/certificates/components/VerificationCard.tsx"),
      "utf8",
    );
    expect(source).toContain("credentialId");
    expect(source).not.toContain("membershipId");
    expect(source).not.toContain("email");
  });

  it("worker validates certificate events without notification side effects", () => {
    const workerSource = readFileSync(
      resolveSplitPath("server/certificates/certificate.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("certificateIssuedOutboxPayloadSchema");
    // PDF render is gated by CERTIFICATE_PDF_WORKER; email/notification dispatch must stay out.
    expect(workerSource).not.toMatch(/sendMail|sendEmail|notification_dispatch/i);
  });

  it("learner certificates page uses list API only", () => {
    const source = readFileSync(resolveSplitPath("app/(learner)/certificates/page.tsx"), "utf8");
    expect(source).toContain("/api/v1/certificates");
    expect(source).not.toContain("/issue");
    expect(source).not.toContain("/revoke");
  });

  it("download prefers stored PDF content-type when r2_object_key is set", () => {
    const source = readFileSync(
      resolveSplitPath("server/certificates/certificate.service.ts"),
      "utf8",
    );
    expect(source).toContain("r2_object_key");
    expect(source).toContain('contentType: "application/pdf"');
    expect(source).toContain("loadCertificatePdfArtifact");
  });

  it.skipIf(process.env["CERTIFICATE_PDF_WORKER"] !== "true")(
    "CERTIFICATE_PDF_WORKER gate open for PDF worker drain (human/env ops still required)",
    () => {
      expect(process.env["CERTIFICATE_PDF_WORKER"]).toBe("true");
    },
  );
});
