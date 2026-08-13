import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type {
  CertificateBrandKitRow,
  CertificateRow,
  CertificateStatusListRow,
  CertificateTemplateRow,
  CertificateWalletPassRow,
} from "./certificate.types";

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

  async membershipDisplayName(tx: TenantTx, membershipId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ display_name: string | null }>>`
      select mp.display_name
      from memberships m
      left join member_profiles mp on mp.membership_id = m.id
      where m.id = ${membershipId}::uuid
        and m.status = 'ACTIVE'
      limit 1
    `;
    return rows[0]?.display_name ?? null;
  },

  async courseTitle(tx: TenantTx, courseId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ title: string }>>`
      select title
      from courses
      where id = ${courseId}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0]?.title ?? null;
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
        metadata_json,
        expires_at,
        suspended_at,
        serial_number,
        design_snapshot_json,
        design_snapshot_hash,
        recipient_name,
        course_title,
        status_list_index,
        vc_json,
        vc_object_key,
        blockchain_anchor,
        created_at,
        updated_at
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
        metadata_json,
        expires_at,
        suspended_at,
        serial_number,
        design_snapshot_json,
        design_snapshot_hash,
        recipient_name,
        course_title,
        status_list_index,
        vc_json,
        vc_object_key,
        blockchain_anchor,
        created_at,
        updated_at
      from certificates
      where tenant_id = ${tenantId}::uuid
        and credential_id = ${credentialId}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findCertificateByIssuanceIdempotencyKey(
    tx: TenantTx,
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CertificateRow | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from certificates
      where tenant_id = ${tenantId}::uuid
        and metadata_json->'issuance'->>'idempotencyKey' = ${idempotencyKey}
      order by issued_at desc
      limit 1
    `;
    return rows[0] ? this.findCertificateById(tx, rows[0].id) : null;
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
        c.expires_at,
        c.suspended_at,
        c.serial_number,
        c.design_snapshot_json,
        c.design_snapshot_hash,
        c.recipient_name,
        c.course_title,
        c.status_list_index,
        c.vc_json,
        c.vc_object_key,
        c.blockchain_anchor,
        c.created_at,
        c.updated_at,
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
      recipientName: string | null;
      courseTitle: string | null;
      designSnapshotJson: unknown;
      designSnapshotHash: string;
      expiresAt: Date | null;
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
        metadata_json,
        recipient_name,
        course_title,
        design_snapshot_json,
        design_snapshot_hash,
        expires_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.templateId}::uuid,
        ${args.membershipId}::uuid,
        ${args.credentialId},
        'issued',
        now(),
        ${JSON.stringify(args.metadataJson)}::jsonb,
        ${args.recipientName},
        ${args.courseTitle},
        ${JSON.stringify(args.designSnapshotJson)}::jsonb,
        ${args.designSnapshotHash},
        ${args.expiresAt},
        now()
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
      recipientName: string | null;
      courseTitle: string | null;
      designSnapshotJson: unknown;
      designSnapshotHash: string;
      expiresAt: Date | null;
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
        metadata_json = ${JSON.stringify(args.metadataJson)}::jsonb,
        updated_at = now()
      where id = ${args.certificateId}::uuid
        and status = 'issued'
    `;

    return this.findCertificateById(tx, args.certificateId);
  },

  async suspendCertificate(
    tx: TenantTx,
    args: { certificateId: string; metadataJson: Record<string, unknown> },
  ): Promise<CertificateRow | null> {
    await tx.$executeRaw`
      update certificates
      set status = 'suspended',
          suspended_at = now(),
          metadata_json = ${JSON.stringify(args.metadataJson)}::jsonb,
          updated_at = now()
      where id = ${args.certificateId}::uuid
        and status = 'issued'
    `;
    return this.findCertificateById(tx, args.certificateId);
  },

  async expireCertificate(
    tx: TenantTx,
    args: { certificateId: string; metadataJson: Record<string, unknown> },
  ): Promise<CertificateRow | null> {
    await tx.$executeRaw`
      update certificates
      set status = 'expired',
          expires_at = coalesce(expires_at, now()),
          metadata_json = ${JSON.stringify(args.metadataJson)}::jsonb,
          updated_at = now()
      where id = ${args.certificateId}::uuid
        and status in ('issued', 'suspended')
    `;
    return this.findCertificateById(tx, args.certificateId);
  },

  async analyticsCounts(tx: TenantTx, tenantId: string) {
    const rows = await tx.$queryRaw<Array<{ status: string; count: bigint }>>`
      select status, count(*)::bigint as count
      from certificates
      where tenant_id = ${tenantId}::uuid
      group by status
    `;
    return rows;
  },

  async expireDueCertificates(tx: TenantTx): Promise<number> {
    return tx.$executeRaw`
      update certificates
      set status = 'expired', updated_at = now()
      where status = 'issued'
        and expires_at is not null
        and expires_at < now()
    `;
  },

  async listDueCertificates(
    tx: TenantTx,
  ): Promise<Array<{ id: string; credential_id: string; status_list_index: number | null }>> {
    return tx.$queryRaw<
      Array<{ id: string; credential_id: string; status_list_index: number | null }>
    >`
      select id::text, credential_id, status_list_index
      from certificates
      where status = 'issued'
        and expires_at is not null
        and expires_at < now()
    `;
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

  async storeVcJson(tx: TenantTx, args: { certificateId: string; vcJson: unknown }): Promise<void> {
    await tx.$executeRaw`
      update certificates
      set vc_json = ${JSON.stringify(args.vcJson)}::jsonb,
          updated_at = now()
      where id = ${args.certificateId}::uuid
    `;
  },

  async updateBlockchainAnchor(
    tx: TenantTx,
    args: { certificateId: string; anchor: string },
  ): Promise<void> {
    await tx.$executeRaw`
      update certificates
      set blockchain_anchor = ${args.anchor},
          updated_at = now()
      where id = ${args.certificateId}::uuid
    `;
  },

  async assignStatusListIndex(
    tx: TenantTx,
    args: { tenantId: string; certificateId: string },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ next_index: number }>>`
      select coalesce(max(status_list_index), -1) + 1 as next_index
      from certificates
      where tenant_id = ${args.tenantId}::uuid
    `;
    const nextIndex = rows[0]?.next_index ?? 0;
    await tx.$executeRaw`
      update certificates
      set status_list_index = ${nextIndex},
          updated_at = now()
      where id = ${args.certificateId}::uuid
    `;
    return nextIndex;
  },

  async findStatusListById(tx: TenantTx, id: string): Promise<CertificateStatusListRow | null> {
    const rows = await tx.$queryRaw<CertificateStatusListRow[]>`
      select
        id::text,
        tenant_id::text,
        purpose,
        encoded_list,
        bit_length,
        version,
        created_at,
        updated_at
      from certificate_status_lists
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findOrCreateStatusList(
    tx: TenantTx,
    args: { tenantId: string; purpose: string; bitLength: number },
  ): Promise<CertificateStatusListRow> {
    const existing = await tx.$queryRaw<CertificateStatusListRow[]>`
      select
        id::text,
        tenant_id::text,
        purpose,
        encoded_list,
        bit_length,
        version,
        created_at,
        updated_at
      from certificate_status_lists
      where tenant_id = ${args.tenantId}::uuid
        and purpose = ${args.purpose}
      order by created_at asc
      limit 1
    `;
    if (existing[0]) {
      return existing[0];
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into certificate_status_lists (
        id, tenant_id, purpose, encoded_list, bit_length, version, created_at, updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.purpose},
        '',
        ${args.bitLength},
        1,
        now(),
        now()
      )
    `;

    const created = await this.findStatusListById(tx, id);
    if (!created) {
      throw new Error("Failed to create certificate status list.");
    }
    return created;
  },

  async updateStatusListEncoded(
    tx: TenantTx,
    args: { id: string; encodedList: string; version: number },
  ): Promise<void> {
    await tx.$executeRaw`
      update certificate_status_lists
      set encoded_list = ${args.encodedList},
          version = ${args.version},
          updated_at = now()
      where id = ${args.id}::uuid
    `;
  },

  async listBrandKits(tx: TenantTx, tenantId: string): Promise<CertificateBrandKitRow[]> {
    return tx.$queryRaw<CertificateBrandKitRow[]>`
      select
        id::text,
        tenant_id::text,
        name,
        logo_url,
        colors_json,
        fonts_json,
        assets_json,
        created_at,
        updated_at,
        deleted_at
      from certificate_brand_kits
      where tenant_id = ${tenantId}::uuid
        and deleted_at is null
      order by name asc, created_at asc
    `;
  },

  async findBrandKitById(tx: TenantTx, id: string): Promise<CertificateBrandKitRow | null> {
    const rows = await tx.$queryRaw<CertificateBrandKitRow[]>`
      select
        id::text,
        tenant_id::text,
        name,
        logo_url,
        colors_json,
        fonts_json,
        assets_json,
        created_at,
        updated_at,
        deleted_at
      from certificate_brand_kits
      where id = ${id}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertBrandKit(
    tx: TenantTx,
    args: {
      tenantId: string;
      name: string;
      logoUrl: string | null;
      colors: unknown;
      fonts: unknown;
      assets: unknown;
    },
  ): Promise<CertificateBrandKitRow> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into certificate_brand_kits (
        id, tenant_id, name, logo_url, colors_json, fonts_json, assets_json, created_at, updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.name},
        ${args.logoUrl},
        ${JSON.stringify(args.colors)}::jsonb,
        ${JSON.stringify(args.fonts)}::jsonb,
        ${JSON.stringify(args.assets)}::jsonb,
        now(),
        now()
      )
    `;
    const created = await this.findBrandKitById(tx, id);
    if (!created) {
      throw new Error("Failed to create certificate brand kit.");
    }
    return created;
  },

  async updateBrandKit(
    tx: TenantTx,
    args: {
      id: string;
      name: string | null;
      logoUrl: string | null | undefined;
      logoProvided: boolean;
      colors: unknown;
      fonts: unknown;
      assets: unknown;
    },
  ): Promise<CertificateBrandKitRow | null> {
    await tx.$executeRaw`
      update certificate_brand_kits
      set
        name = coalesce(${args.name}, name),
        logo_url = case when ${args.logoProvided} then ${args.logoUrl ?? null} else logo_url end,
        colors_json = coalesce(${
          args.colors === undefined ? null : JSON.stringify(args.colors)
        }::jsonb, colors_json),
        fonts_json = coalesce(${
          args.fonts === undefined ? null : JSON.stringify(args.fonts)
        }::jsonb, fonts_json),
        assets_json = coalesce(${
          args.assets === undefined ? null : JSON.stringify(args.assets)
        }::jsonb, assets_json),
        updated_at = now()
      where id = ${args.id}::uuid
        and deleted_at is null
    `;
    return this.findBrandKitById(tx, args.id);
  },

  async softDeleteBrandKit(tx: TenantTx, id: string): Promise<boolean> {
    const affected = await tx.$executeRaw`
      update certificate_brand_kits
      set deleted_at = now(), updated_at = now()
      where id = ${id}::uuid
        and deleted_at is null
    `;
    return affected > 0;
  },

  async findWalletPass(
    tx: TenantTx,
    args: {
      tenantId: string;
      certificateId: string;
      platform: "apple" | "google";
    },
  ): Promise<CertificateWalletPassRow | null> {
    const rows = await tx.$queryRaw<CertificateWalletPassRow[]>`
      select
        id,
        tenant_id,
        certificate_id,
        platform,
        pass_object_key,
        external_id,
        status,
        created_at,
        updated_at,
        revoked_at
      from certificate_wallet_passes
      where tenant_id = ${args.tenantId}::uuid
        and certificate_id = ${args.certificateId}::uuid
        and platform = ${args.platform}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertWalletPass(
    tx: TenantTx,
    args: {
      tenantId: string;
      certificateId: string;
      platform: "apple" | "google";
      passObjectKey: string | null;
      externalId: string | null;
      status: string;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      insert into certificate_wallet_passes (
        id, tenant_id, certificate_id, platform, pass_object_key, external_id, status, created_at, updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.certificateId}::uuid,
        ${args.platform},
        ${args.passObjectKey},
        ${args.externalId},
        ${args.status},
        now(),
        now()
      )
      on conflict (tenant_id, certificate_id, platform)
      do update set
        pass_object_key = excluded.pass_object_key,
        external_id = excluded.external_id,
        status = excluded.status,
        updated_at = now()
    `;
  },

  async setCertificateR2ObjectKey(
    tx: TenantTx,
    args: { certificateId: string; objectKey: string },
  ): Promise<void> {
    await tx.$executeRaw`
      update certificates
      set r2_object_key = ${args.objectKey}, updated_at = now()
      where id = ${args.certificateId}::uuid
    `;
  },

  async insertRenderJob(
    tx: TenantTx,
    args: {
      tenantId: string;
      certificateId: string;
      templateId: string;
      format?: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into certificate_render_jobs (
        id,
        tenant_id,
        certificate_id,
        template_id,
        status,
        format,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.certificateId}::uuid,
        ${args.templateId}::uuid,
        'RUNNING'::"JobStatus",
        ${args.format ?? "pdf"},
        now(),
        now()
      )
    `;
    return id;
  },

  async completeRenderJob(tx: TenantTx, args: { jobId: string; objectKey: string }): Promise<void> {
    await tx.$executeRaw`
      update certificate_render_jobs
      set
        status = 'SUCCEEDED'::"JobStatus",
        r2_object_key = ${args.objectKey},
        completed_at = now(),
        updated_at = now(),
        error_message = null
      where id = ${args.jobId}::uuid
    `;
  },

  async failRenderJob(tx: TenantTx, args: { jobId: string; errorMessage: string }): Promise<void> {
    await tx.$executeRaw`
      update certificate_render_jobs
      set
        status = 'FAILED'::"JobStatus",
        error_message = ${args.errorMessage.slice(0, 500)},
        completed_at = now(),
        updated_at = now()
      where id = ${args.jobId}::uuid
    `;
  },
};
