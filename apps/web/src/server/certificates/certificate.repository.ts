import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { CertificateRow, CertificateTemplateRow } from "./certificate.types";

export type WorkflowDefinitionRow = {
  id: string;
  key: string;
  definition_json: Record<string, unknown>;
};

function parseTemplateJson(value: unknown) {
  return value;
}

export const certificateRepository = {
  async findTemplateById(tx: TenantTx, templateId: string): Promise<CertificateTemplateRow | null> {
    const rows = await tx.$queryRaw<CertificateTemplateRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        name,
        template_json,
        status::text as status,
        created_at,
        updated_at,
        deleted_at
      from certificate_templates
      where id = ${templateId}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findTemplateByKey(tx: TenantTx, tenantId: string, key: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from certificate_templates
      where tenant_id = ${tenantId}::uuid
        and key = ${key}
        and deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listTemplates(tx: TenantTx, tenantId: string): Promise<CertificateTemplateRow[]> {
    return tx.$queryRaw<CertificateTemplateRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        name,
        template_json,
        status::text as status,
        created_at,
        updated_at,
        deleted_at
      from certificate_templates
      where tenant_id = ${tenantId}::uuid
        and deleted_at is null
      order by updated_at desc
    `;
  },

  async insertTemplate(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      templateJson: unknown;
    },
  ): Promise<CertificateTemplateRow> {
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
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${JSON.stringify(args.templateJson)}::jsonb,
        'DRAFT',
        now(),
        now()
      )
    `;

    const created = await this.findTemplateById(tx, id);
    if (!created) {
      throw new Error("Failed to create certificate template.");
    }
    return created;
  },

  async updateTemplate(
    tx: TenantTx,
    args: {
      templateId: string;
      key?: string;
      name?: string;
      templateJson?: unknown;
    },
  ): Promise<CertificateTemplateRow | null> {
    const existing = await this.findTemplateById(tx, args.templateId);
    if (!existing) return null;

    await tx.$executeRaw`
      update certificate_templates
      set
        key = ${args.key ?? existing.key},
        name = ${args.name ?? existing.name},
        template_json = ${JSON.stringify(args.templateJson ?? parseTemplateJson(existing.template_json))}::jsonb,
        updated_at = now()
      where id = ${args.templateId}::uuid
        and deleted_at is null
    `;

    return this.findTemplateById(tx, args.templateId);
  },

  async softDeleteTemplate(tx: TenantTx, templateId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      update certificate_templates
      set deleted_at = now(), updated_at = now()
      where id = ${templateId}::uuid
        and deleted_at is null
    `;
    return result > 0;
  },

  async updateTemplateStatus(tx: TenantTx, templateId: string, status: string): Promise<void> {
    await tx.$executeRaw`
      update certificate_templates
      set status = ${status}::"PublishStatus", updated_at = now()
      where id = ${templateId}::uuid
        and deleted_at is null
    `;
  },

  async findWorkflowDefinitionByKey(
    tx: TenantTx,
    key: string,
  ): Promise<WorkflowDefinitionRow | null> {
    const rows = await tx.$queryRaw<WorkflowDefinitionRow[]>`
      select id::text, key, definition_json
      from workflow_definitions
      where key = ${key}
        and status = 'ACTIVE'
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertWorkflowTransition(
    tx: TenantTx,
    args: {
      tenantId: string;
      workflowDefinitionId: string;
      targetType: string;
      targetId: string;
      fromState: string;
      toState: string;
      actorMembershipId: string;
      reason?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ id: string }> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into workflow_transitions (
        id,
        tenant_id,
        workflow_definition_id,
        target_type,
        target_id,
        from_state,
        to_state,
        actor_membership_id,
        reason,
        metadata_json,
        occurred_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.workflowDefinitionId}::uuid,
        ${args.targetType},
        ${args.targetId}::uuid,
        ${args.fromState},
        ${args.toState},
        ${args.actorMembershipId}::uuid,
        ${args.reason ?? null},
        ${JSON.stringify(args.metadata ?? {})}::jsonb,
        now()
      )
    `;
    return { id };
  },

  async membershipIsActive(tx: TenantTx, membershipId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from memberships
      where id = ${membershipId}::uuid
        and status = 'ACTIVE'
      limit 1
    `;
    return rows.length > 0;
  },

  async findCertificateById(tx: TenantTx, certificateId: string): Promise<CertificateRow | null> {
    const rows = await tx.$queryRaw<CertificateRow[]>`
      select
        id::text,
        tenant_id::text,
        template_id::text,
        membership_id::text,
        credential_id,
        status,
        issued_at,
        revoked_at,
        r2_object_key,
        metadata_json
      from certificates
      where id = ${certificateId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findCertificateByCredentialId(
    tx: TenantTx,
    tenantId: string,
    credentialId: string,
  ): Promise<CertificateRow | null> {
    const rows = await tx.$queryRaw<CertificateRow[]>`
      select
        id::text,
        tenant_id::text,
        template_id::text,
        membership_id::text,
        credential_id,
        status,
        issued_at,
        revoked_at,
        r2_object_key,
        metadata_json
      from certificates
      where tenant_id = ${tenantId}::uuid
        and credential_id = ${credentialId}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listCertificates(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId?: string;
      status?: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<
    Array<
      CertificateRow & {
        template_name: string;
        recipient_label: string | null;
      }
    >
  > {
    return tx.$queryRaw`
      select
        c.id::text,
        c.tenant_id::text,
        c.template_id::text,
        c.membership_id::text,
        c.credential_id,
        c.status,
        c.issued_at,
        c.revoked_at,
        c.r2_object_key,
        c.metadata_json,
        ct.name as template_name,
        mp.display_name as recipient_label
      from certificates c
      join certificate_templates ct on ct.id = c.template_id
      left join member_profiles mp on mp.membership_id = c.membership_id
      where c.tenant_id = ${args.tenantId}::uuid
        and (${args.membershipId ?? null}::uuid is null or c.membership_id = ${args.membershipId ?? null}::uuid)
        and (${args.status ?? null}::text is null or c.status = ${args.status ?? null})
        and (${args.cursor ?? null}::uuid is null or c.id < ${args.cursor ?? null}::uuid)
      order by c.issued_at desc, c.id desc
      limit ${args.limit + 1}
    `;
  },

  async insertCertificate(
    tx: TenantTx,
    args: {
      id?: string;
      tenantId: string;
      templateId: string;
      membershipId: string;
      credentialId: string;
      metadataJson: Record<string, unknown>;
    },
  ): Promise<CertificateRow> {
    const id = args.id ?? randomUUID();
    await tx.$executeRaw`
      insert into certificates (
        id,
        tenant_id,
        template_id,
        membership_id,
        credential_id,
        status,
        issued_at,
        metadata_json
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.templateId}::uuid,
        ${args.membershipId}::uuid,
        ${args.credentialId},
        'issued',
        now(),
        ${JSON.stringify(args.metadataJson)}::jsonb
      )
    `;

    const created = await this.findCertificateById(tx, id);
    if (!created) {
      throw new Error("Failed to issue certificate.");
    }
    return created;
  },

  async insertCertificateWithId(
    tx: TenantTx,
    args: {
      id: string;
      tenantId: string;
      templateId: string;
      membershipId: string;
      credentialId: string;
      metadataJson: Record<string, unknown>;
    },
  ): Promise<CertificateRow> {
    return this.insertCertificate(tx, args);
  },

  async revokeCertificate(
    tx: TenantTx,
    args: {
      certificateId: string;
      metadataJson: Record<string, unknown>;
    },
  ): Promise<CertificateRow | null> {
    await tx.$executeRaw`
      update certificates
      set
        status = 'revoked',
        revoked_at = now(),
        metadata_json = ${JSON.stringify(args.metadataJson)}::jsonb
      where id = ${args.certificateId}::uuid
        and status = 'issued'
    `;

    return this.findCertificateById(tx, args.certificateId);
  },

  async insertCredentialVerification(
    tx: TenantTx,
    args: {
      tenantId: string;
      certificateId: string;
      ipHash: string | null;
      userAgentHash: string | null;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      insert into credential_verifications (
        id,
        tenant_id,
        certificate_id,
        ip_hash,
        user_agent_hash,
        occurred_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.certificateId}::uuid,
        ${args.ipHash},
        ${args.userAgentHash},
        now()
      )
    `;
  },

  async courseInstructorMembershipId(tx: TenantTx, courseId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ created_by_membership_id: string }>>`
      select created_by_membership_id::text
      from courses
      where id = ${courseId}::uuid
      limit 1
    `;
    return rows[0]?.created_by_membership_id ?? null;
  },

  async pathInstructorMembershipId(tx: TenantTx, pathId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ created_by_membership_id: string }>>`
      select created_by_membership_id::text
      from learning_paths
      where id = ${pathId}::uuid
      limit 1
    `;
    return rows[0]?.created_by_membership_id ?? null;
  },

  async assessmentAuthorMembershipId(tx: TenantTx, assessmentId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ author_id: string | null }>>`
      select (config_json->>'createdByMembershipId')::text as author_id
      from assessments
      where id = ${assessmentId}::uuid
      limit 1
    `;
    return rows[0]?.author_id ?? null;
  },

  async sourceIsPublished(tx: TenantTx, source: { type: string; id: string }): Promise<boolean> {
    if (source.type === "course") {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        select status::text from courses where id = ${source.id}::uuid limit 1
      `;
      return rows[0]?.status === "PUBLISHED";
    }

    if (source.type === "learning_path") {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        select status::text from learning_paths where id = ${source.id}::uuid limit 1
      `;
      return rows[0]?.status === "PUBLISHED";
    }

    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      select status::text from assessments where id = ${source.id}::uuid limit 1
    `;
    return rows[0]?.status === "PUBLISHED";
  },
};
