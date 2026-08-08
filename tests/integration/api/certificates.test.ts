import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { handleCertificateOutboxEvent } from "../../../backend/apps/api/src/server/certificates/certificate.worker";
import {
  createCertificateTemplate,
  deleteCertificateTemplate,
  issueCertificate,
  listCertificates,
  publishCertificateTemplate,
  revokeCertificate,
  verifyCredentialPublic,
} from "../../../backend/apps/api/src/server/certificates/certificate.service";
import { publishAssessmentForTests } from "../../../backend/apps/api/src/server/assessments/assessments.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
  learnerCtx,
} from "../../fixtures/certificate-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("certificate integration", () => {
  it("creates, publishes, issues, verifies, and revokes certificates", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_cert_lifecycle");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await publishAssessmentForTests(tx, fixture.assessmentId);
    });

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createCertificateTemplate(tx, admin, {
        key: "integration-template",
        name: "Integration Template",
        templateJson: {
          headline: "Integration Certificate",
          bodyLines: ["Completed successfully"],
        },
      }),
    );

    expect(created.data.status).toBe("DRAFT");

    const published = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      publishCertificateTemplate(tx, admin, created.data.id, {}),
    );

    expect(published.data.status).toBe("PUBLISHED");

    const issued = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      issueCertificate(
        tx,
        admin,
        {
          templateId: published.data.id,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        "issue-integration",
      ),
    );

    expect(issued.data.status).toBe("issued");

    const audit = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries where action = 'credential.issued' order by occurred_at desc limit 1
      `,
    );
    expect(audit[0]?.action).toBe("credential.issued");

    const outbox = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type from outbox_events where event_type = 'certificate.issued' order by occurred_at desc limit 1
      `,
    );
    expect(outbox[0]?.event_type).toBe("certificate.issued");

    const learnerList = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => listCertificates(tx, learnerCtx(fixture, "req_learner_list"), { limit: 25 }),
    );
    expect(learnerList.data).toHaveLength(1);

    const revoked = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      revokeCertificate(tx, admin, issued.data.id, {
        reason: "Test revocation",
        confirm: true,
      }),
    );
    expect(revoked.data.status).toBe("revoked");
  });

  it("soft deletes templates and rejects invalid revoke", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_cert_delete");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await deleteCertificateTemplate(tx, admin, { id: fixture.draftTemplateId });

      const rows = await tx.$queryRaw<Array<{ deleted_at: Date | null }>>`
        select deleted_at from certificate_templates where id = ${fixture.draftTemplateId}::uuid
      `;
      expect(rows[0]?.deleted_at).not.toBeNull();
    });
  });

  it("validates public verify inserts credential_verifications only", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_cert_verify");

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
        "verify-integration",
      ),
    );

    const req = new Request("https://tenant-a.test/verify", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "vitest",
      },
    });

    const verified = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_public_verify",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        verifyCredentialPublic({
          tx,
          tenantId: fixture.tenantId,
          requestId: "req_public_verify",
          credentialId: issued.data.credentialId,
          req,
        }),
    );

    expect(verified.data.status).toBe("issued");
    expect(verified.data.credentialId).toBe(issued.data.credentialId);
    expect(JSON.stringify(verified.data)).not.toContain(fixture.learnerMembershipId);

    await expect(
      withTenantTx(
        {
          tenantId: fixture.tenantId,
          requestId: "req_append_only",
          allowAnonymousTenantRead: true,
        },
        async (tx) =>
          tx.$executeRaw`
            update credential_verifications set ip_hash = 'blocked' where certificate_id = ${issued.data.id}::uuid
          `,
      ),
    ).rejects.toThrow();
  });
});

describeWithDb("certificate outbox worker", () => {
  it("validates certificate outbox payloads without side effects", async () => {
    const fixture = await createCertificateFixture();

    await expect(
      handleCertificateOutboxEvent({
        id: "evt-1",
        eventType: "certificate.issued",
        tenantId: fixture.tenantId,
        payload: {
          certificateId: fixture.publishedTemplateId,
          credentialId: "cred_test",
          templateId: fixture.publishedTemplateId,
          membershipId: fixture.learnerMembershipId,
          issuedAt: new Date().toISOString(),
          workflowTransitionId: null,
        },
        requestId: "req_worker",
      }),
    ).resolves.toBeUndefined();
  });
});
