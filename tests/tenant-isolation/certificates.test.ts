import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { certificateRepository } from "../../apps/web/src/server/certificates/certificate.repository";
import {
  issueCertificate,
  revokeCertificate,
  verifyCredentialPublic,
} from "../../apps/web/src/server/certificates/certificate.service";
import { publishAssessmentForTests } from "../../apps/web/src/server/assessments/assessments.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
} from "../fixtures/certificate-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const CERTIFICATE_TABLES = [
  "certificate_templates",
  "certificates",
  "credential_verifications",
] as const;

describeWithDb("certificate tenant isolation", () => {
  it("RLS filters certificate tables to current tenant", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();

    for (const table of CERTIFICATE_TABLES) {
      const rows = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
        tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          `select tenant_id::text from ${table} where tenant_id = $1::uuid`,
          fixture.tenantId,
        ),
      );

      expect(rows).toHaveLength(0);
    }
  });

  it("does not verify credentials across tenants", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();
    const admin = adminCtx(fixture, "req_iso_issue");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await publishAssessmentForTests(tx, fixture.assessmentId);
    });

    const issued = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      issueCertificate(
        tx,
        admin,
        {
          templateId: fixture.publishedTemplateId,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        "iso-issue",
      ),
    );

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        verifyCredentialPublic({
          tx,
          tenantId: isolation.tenantB.tenantId,
          requestId: "req_iso_verify",
          credentialId: issued.data.credentialId,
          req: new Request("https://tenant-b.test"),
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects credential_verifications update and delete", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_iso_append");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await publishAssessmentForTests(tx, fixture.assessmentId);
    });

    const issued = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      issueCertificate(
        tx,
        admin,
        {
          templateId: fixture.publishedTemplateId,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        "iso-append",
      ),
    );

    await withTenantTx(
      { tenantId: fixture.tenantId, requestId: "req_verify_log", allowAnonymousTenantRead: true },
      async (tx) => {
        await verifyCredentialPublic({
          tx,
          tenantId: fixture.tenantId,
          requestId: "req_verify_log",
          credentialId: issued.data.credentialId,
          req: new Request("https://tenant-a.test"),
        });
      },
    );

    await expect(
      withTenantTx(
        {
          tenantId: fixture.tenantId,
          requestId: "req_delete_verify",
          allowAnonymousTenantRead: true,
        },
        async (tx) =>
          tx.$executeRaw`
            delete from credential_verifications where certificate_id = ${issued.data.id}::uuid
          `,
      ),
    ).rejects.toThrow();
  });

  it("prevents cross-tenant revoke", async () => {
    const fixture = await createCertificateFixture();
    const isolation = await createTenantIsolationFixture();
    const admin = adminCtx(fixture, "req_iso_revoke");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await publishAssessmentForTests(tx, fixture.assessmentId);
    });

    const issued = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      issueCertificate(
        tx,
        admin,
        {
          templateId: fixture.publishedTemplateId,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        "iso-revoke",
      ),
    );

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        revokeCertificate(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "req_foreign_revoke",
          },
          issued.data.id,
          {
            reason: "Should fail",
            confirm: true,
          },
        ),
      ),
    ).rejects.toThrow();

    const stillIssued = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      certificateRepository.findCertificateById(tx, issued.data.id),
    );
    expect(stillIssued?.status).toBe("issued");
  });
});
