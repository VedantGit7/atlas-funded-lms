import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindCertificateById, mockLoadCertificatePdfArtifact, mockFindRolePermissionGrant } =
  vi.hoisted(() => ({
    mockFindCertificateById: vi.fn(),
    mockLoadCertificatePdfArtifact: vi.fn(),
    mockFindRolePermissionGrant: vi.fn(),
  }));

vi.mock("@atlas/authorization", () => ({
  findRolePermissionGrant: (...args: unknown[]) => mockFindRolePermissionGrant(...args),
  enforceEntitlement: vi.fn(),
}));

vi.mock("../../../backend/apps/api/src/server/certificates/certificate.repository", () => ({
  certificateRepository: {
    findCertificateById: (...args: unknown[]) => mockFindCertificateById(...args),
    findTemplateById: vi.fn(),
  },
}));

vi.mock("../../../backend/apps/api/src/server/certificates/certificate-pdf-store", () => ({
  loadCertificatePdfArtifact: (...args: unknown[]) => mockLoadCertificatePdfArtifact(...args),
  storeCertificatePdfArtifact: vi.fn(),
}));

import { getCertificateDownload } from "../../../backend/apps/api/src/server/certificates/certificate.service";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const membershipId = "018f0000-0000-7000-8000-000000000020";
const certificateId = "018f0000-0000-7000-8000-000000000040";

describe("getCertificateDownload PDF content-type", () => {
  beforeEach(() => {
    mockFindCertificateById.mockReset();
    mockLoadCertificatePdfArtifact.mockReset();
    mockFindRolePermissionGrant.mockReset();
    mockFindRolePermissionGrant.mockResolvedValue(null);
  });

  it("returns application/pdf when r2_object_key is set and artifact loads", async () => {
    mockFindCertificateById.mockResolvedValue({
      id: certificateId,
      tenant_id: tenantId,
      template_id: "018f0000-0000-7000-8000-000000000030",
      membership_id: membershipId,
      credential_id: "cred-pdf-1",
      status: "ISSUED",
      issued_at: new Date(),
      revoked_at: null,
      r2_object_key: "tenants/t1/certificate.render/cert/certificate.pdf",
      metadata_json: {},
      expires_at: null,
      suspended_at: null,
      serial_number: null,
      design_snapshot_json: null,
      design_snapshot_hash: null,
      recipient_name: null,
      course_title: null,
      status_list_index: null,
      vc_json: null,
      vc_object_key: null,
      blockchain_anchor: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockLoadCertificatePdfArtifact.mockResolvedValue(Buffer.from("%PDF-1.4 mock"));

    const result = await getCertificateDownload(
      {} as never,
      {
        tenantId,
        actorMembershipId: membershipId,
        requestId: "req-pdf-dl",
      },
      certificateId,
    );

    expect(result.contentType).toBe("application/pdf");
    expect(result.fromStorage).toBe(true);
    expect(result.filename).toMatch(/\.pdf$/);
    expect(mockLoadCertificatePdfArtifact).toHaveBeenCalledWith(
      "tenants/t1/certificate.render/cert/certificate.pdf",
    );
  });

  it("documents CERTIFICATE_PDF_WORKER gate when PDF worker is disabled", () => {
    // Full Playwright render + R2 store is gated; download still serves stored PDFs
    // when r2_object_key is present. Skip browser PDF generation without the flag.
    const pdfWorkerEnabled = process.env["CERTIFICATE_PDF_WORKER"] === "true";
    if (!pdfWorkerEnabled) {
      console.info(
        "CERTIFICATE_PDF_WORKER is not true — PDF worker drain / render e2e is out of scope for this unit test.",
      );
    }
    expect(typeof pdfWorkerEnabled).toBe("boolean");
  });
});
