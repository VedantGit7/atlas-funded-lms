import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  type AssessmentFixture,
} from "./assessment-fixture";

export type CertificateFixture = AssessmentFixture & {
  templateId: string;
  publishedTemplateId: string;
  draftTemplateId: string;
};

export async function seedCertificationEntitlement(fixture: CertificateFixture) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into entitlements (
        id,
        tenant_id,
        key,
        value_json,
        source,
        starts_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        'certification.enable',
        'true'::jsonb,
        'test-fixture',
        now(),
        null,
        now(),
        now()
      )
      on conflict (tenant_id, key) do update set
        value_json = excluded.value_json,
        updated_at = now()
    `;
  });
}

async function seedCertificateWorkflows(fixture: CertificateFixture) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    for (const definition of [
      {
        key: "certificate_template.publish",
        name: "Certificate template publish review",
        definitionJson: {
          targetType: "certificate_template",
          requiresReview: false,
        },
      },
      {
        key: "certificate.issue",
        name: "Certificate issuance review",
        definitionJson: {
          targetType: "certificate",
          requiresReview: false,
        },
      },
    ]) {
      await tx.$executeRaw`
        insert into workflow_definitions (
          id,
          tenant_id,
          key,
          name,
          definition_json,
          status,
          created_at,
          updated_at
        )
        select
          gen_random_uuid(),
          ${fixture.tenantId}::uuid,
          ${definition.key},
          ${definition.name},
          ${JSON.stringify(definition.definitionJson)}::jsonb,
          'ACTIVE',
          now(),
          now()
        where not exists (
          select 1 from workflow_definitions where key = ${definition.key}
        )
      `;
    }
  });
}

async function seedDraftTemplate(fixture: CertificateFixture): Promise<string> {
  return withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into certificate_templates (
        id,
        tenant_id,
        key,
        name,
        template_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${fixture.tenantId}::uuid,
        'draft-template',
        'Draft Template',
        ${JSON.stringify({
          headline: "Draft Certificate",
          bodyLines: ["Draft body"],
        })}::jsonb,
        'DRAFT',
        now(),
        now()
      )
    `;
    return id;
  });
}

async function seedPublishedTemplate(fixture: CertificateFixture): Promise<string> {
  return withTenantTx(authoringTenantTx(fixture), async (tx) => {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into certificate_templates (
        id,
        tenant_id,
        key,
        name,
        template_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${fixture.tenantId}::uuid,
        'published-template',
        'Published Template',
        ${JSON.stringify({
          headline: "Published Certificate",
          bodyLines: ["Published body"],
        })}::jsonb,
        'PUBLISHED',
        now(),
        now()
      )
    `;
    return id;
  });
}

export async function createCertificateFixture(): Promise<CertificateFixture> {
  const assessmentFixture = await createAssessmentFixture();
  await seedCertificationEntitlement(assessmentFixture);
  await seedCertificateWorkflows(assessmentFixture);
  const draftTemplateId = await seedDraftTemplate(assessmentFixture);
  const publishedTemplateId = await seedPublishedTemplate(assessmentFixture);

  return {
    ...assessmentFixture,
    templateId: draftTemplateId,
    publishedTemplateId,
    draftTemplateId,
  };
}

export { adminCtx, instructorCtx, learnerCtx, authoringTenantTx };
