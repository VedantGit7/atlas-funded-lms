import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

// NOTE: Additional certificate surfaces exist beyond the smoke list below:
//   - app/api/v1/certificate-templates/[id]/approve/route.ts (REVIEW → PUBLISHED)
//   - app/api/v1/certificates/[id]/download/route.ts (HTML attachment / 409)
//   - server/certificates/certificate-feature-flags.ts (extensibility toggles)
//   - server/certificates/learning-path-certificates-settings.ts (stub)
// The PDF worker / render pipeline may exist only as a stub (gated behind the
// CERTIFICATE_PDF_WORKER feature flag); do not assume a full PDF render here.

const certificatePaths = [
  "app/(public)/verify/[credentialId]/page.tsx",
  "app/(learner)/certificates/page.tsx",
  "app/admin/certificates/page.tsx",
  "app/admin/certificates/templates/page.tsx",
  "app/api/v1/certificate-templates/route.ts",
  "app/api/v1/certificate-templates/[id]/publish/route.ts",
  "app/api/v1/certificates/route.ts",
  "app/api/v1/certificates/issue/route.ts",
  "app/api/v1/certificates/[id]/revoke/route.ts",
  "app/api/v1/public/verify/[credentialId]/route.ts",
  "server/certificates/certificate.service.ts",
  "server/certificates/certificate.worker.ts",
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
    expect(workerSource).not.toMatch(/sendMail|sendEmail|notification_dispatch|render.*pdf/i);
  });

  it("learner certificates page uses list API only", () => {
    const source = readFileSync(resolveSplitPath("app/(learner)/certificates/page.tsx"), "utf8");
    expect(source).toContain("/api/v1/certificates");
    expect(source).not.toContain("/issue");
    expect(source).not.toContain("/revoke");
  });
});
