import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { NotificationDispatchRow, NotificationTemplateRow } from "./notification.types";

export const notificationRepository = {
  async listTemplates(tx: TenantTx, tenantId: string): Promise<NotificationTemplateRow[]> {
    return tx.$queryRaw<NotificationTemplateRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        channel,
        locale,
        subject,
        body,
        variables_json,
        status::text as status,
        created_at,
        updated_at
      from notification_templates
      where tenant_id = ${tenantId}::uuid
      order by key asc, channel asc, locale asc
    `;
  },

  async findTemplateById(
    tx: TenantTx,
    templateId: string,
  ): Promise<NotificationTemplateRow | null> {
    const rows = await tx.$queryRaw<NotificationTemplateRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        channel,
        locale,
        subject,
        body,
        variables_json,
        status::text as status,
        created_at,
        updated_at
      from notification_templates
      where id = ${templateId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findTemplateByUniqueKey(
    tx: TenantTx,
    args: { tenantId: string; key: string; channel: string; locale: string },
  ): Promise<NotificationTemplateRow | null> {
    const rows = await tx.$queryRaw<NotificationTemplateRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        channel,
        locale,
        subject,
        body,
        variables_json,
        status::text as status,
        created_at,
        updated_at
      from notification_templates
      where tenant_id = ${args.tenantId}::uuid
        and key = ${args.key}
        and channel = ${args.channel}
        and locale = ${args.locale}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listActiveTemplatesForEvent(
    tx: TenantTx,
    args: { tenantId: string; key: string; locale?: string },
  ): Promise<NotificationTemplateRow[]> {
    const locale = args.locale ?? "en";
    return tx.$queryRaw<NotificationTemplateRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        channel,
        locale,
        subject,
        body,
        variables_json,
        status::text as status,
        created_at,
        updated_at
      from notification_templates
      where tenant_id = ${args.tenantId}::uuid
        and key = ${args.key}
        and locale = ${locale}
        and status = 'ACTIVE'::"EntityStatus"
    `;
  },

  async insertTemplate(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      channel: string;
      locale: string;
      subject: string | null;
      body: string;
      variablesJson: unknown;
      status?: string;
    },
  ): Promise<NotificationTemplateRow> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into notification_templates (
        id,
        tenant_id,
        key,
        channel,
        locale,
        subject,
        body,
        variables_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.channel},
        ${args.locale},
        ${args.subject},
        ${args.body},
        ${JSON.stringify(args.variablesJson)}::jsonb,
        coalesce(${args.status ?? "ACTIVE"}, 'ACTIVE')::"EntityStatus",
        now(),
        now()
      )
    `;

    const created = await notificationRepository.findTemplateById(tx, id);
    if (!created) {
      throw new Error("Failed to create notification template.");
    }
    return created;
  },

  async updateTemplate(
    tx: TenantTx,
    args: {
      templateId: string;
      key?: string;
      channel?: string;
      locale?: string;
      subject?: string | null;
      body?: string;
      variablesJson?: unknown;
      status?: string;
    },
  ): Promise<NotificationTemplateRow | null> {
    const existing = await notificationRepository.findTemplateById(tx, args.templateId);
    if (!existing) return null;

    await tx.$executeRaw`
      update notification_templates
      set
        key = ${args.key ?? existing.key},
        channel = ${args.channel ?? existing.channel},
        locale = ${args.locale ?? existing.locale},
        subject = ${args.subject !== undefined ? args.subject : existing.subject},
        body = ${args.body ?? existing.body},
        variables_json = ${JSON.stringify(args.variablesJson ?? existing.variables_json)}::jsonb,
        status = coalesce(${args.status ?? existing.status}, 'ACTIVE')::"EntityStatus",
        updated_at = now()
      where id = ${args.templateId}::uuid
    `;

    return notificationRepository.findTemplateById(tx, args.templateId);
  },

  async deleteTemplate(tx: TenantTx, templateId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      delete from notification_templates where id = ${templateId}::uuid
    `;
    return result > 0;
  },

  async findDispatchById(
    tx: TenantTx,
    dispatchId: string,
  ): Promise<NotificationDispatchRow | null> {
    const rows = await tx.$queryRaw<NotificationDispatchRow[]>`
      select
        id::text,
        tenant_id::text,
        membership_id::text,
        channel,
        template_key,
        destination,
        idempotency_key,
        status::text as status,
        payload_json,
        error_json,
        created_at,
        sent_at
      from notification_dispatches
      where id = ${dispatchId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findDispatchByIdempotencyKey(
    tx: TenantTx,
    args: { tenantId: string; idempotencyKey: string },
  ): Promise<NotificationDispatchRow | null> {
    const rows = await tx.$queryRaw<NotificationDispatchRow[]>`
      select
        id::text,
        tenant_id::text,
        membership_id::text,
        channel,
        template_key,
        destination,
        idempotency_key,
        status::text as status,
        payload_json,
        error_json,
        created_at,
        sent_at
      from notification_dispatches
      where tenant_id = ${args.tenantId}::uuid
        and idempotency_key = ${args.idempotencyKey}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertDispatch(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      channel: string;
      templateKey: string;
      destination: string | null;
      idempotencyKey: string;
      status: "QUEUED" | "SENT" | "FAILED";
      payloadJson: unknown;
      sentAt?: Date | null;
    },
  ): Promise<NotificationDispatchRow> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into notification_dispatches (
        id,
        tenant_id,
        membership_id,
        channel,
        template_key,
        destination,
        idempotency_key,
        status,
        payload_json,
        created_at,
        sent_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.channel},
        ${args.templateKey},
        ${args.destination},
        ${args.idempotencyKey},
        ${args.status}::"DispatchStatus",
        ${JSON.stringify(args.payloadJson)}::jsonb,
        now(),
        ${args.sentAt ?? null}
      )
    `;

    const created = await notificationRepository.findDispatchById(tx, id);
    if (!created) {
      throw new Error("Failed to create notification dispatch.");
    }
    return created;
  },

  async insertReadReceipt(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      dispatchId: string;
      readAt: Date;
      idempotencyKey: string;
    },
  ): Promise<NotificationDispatchRow> {
    return notificationRepository.insertDispatch(tx, {
      tenantId: args.tenantId,
      membershipId: args.membershipId,
      channel: "in_app",
      templateKey: "__inbox_read__",
      destination: null,
      idempotencyKey: args.idempotencyKey,
      status: "SENT",
      payloadJson: {
        readForDispatchId: args.dispatchId,
        inbox: {
          readAt: args.readAt.toISOString(),
        },
      },
      sentAt: args.readAt,
    });
  },

  async findReadReceiptForDispatch(
    tx: TenantTx,
    args: { tenantId: string; membershipId: string; dispatchId: string },
  ): Promise<NotificationDispatchRow | null> {
    const rows = await tx.$queryRaw<NotificationDispatchRow[]>`
      select
        id::text,
        tenant_id::text,
        membership_id::text,
        channel,
        template_key,
        destination,
        idempotency_key,
        status::text as status,
        payload_json,
        error_json,
        created_at,
        sent_at
      from notification_dispatches
      where tenant_id = ${args.tenantId}::uuid
        and membership_id = ${args.membershipId}::uuid
        and template_key = '__inbox_read__'
        and payload_json->>'readForDispatchId' = ${args.dispatchId}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listInboxDispatches(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<Array<NotificationDispatchRow & { read_at: string | null }>> {
    if (args.cursor) {
      return tx.$queryRaw`
        select
          d.id::text,
          d.tenant_id::text,
          d.membership_id::text,
          d.channel,
          d.template_key,
          d.destination,
          d.idempotency_key,
          d.status::text as status,
          d.payload_json,
          d.error_json,
          d.created_at,
          d.sent_at,
          rr.payload_json->'inbox'->>'readAt' as read_at
        from notification_dispatches d
        left join notification_dispatches rr
          on rr.tenant_id = d.tenant_id
          and rr.membership_id = d.membership_id
          and rr.template_key = '__inbox_read__'
          and rr.payload_json->>'readForDispatchId' = d.id::text
        where d.tenant_id = ${args.tenantId}::uuid
          and d.membership_id = ${args.membershipId}::uuid
          and d.channel = 'in_app'
          and d.status = 'SENT'::"DispatchStatus"
          and d.template_key <> '__inbox_read__'
          and d.created_at < (
            select created_at from notification_dispatches where id = ${args.cursor}::uuid
          )
        order by d.created_at desc
        limit ${args.limit}
      `;
    }

    return tx.$queryRaw`
      select
        d.id::text,
        d.tenant_id::text,
        d.membership_id::text,
        d.channel,
        d.template_key,
        d.destination,
        d.idempotency_key,
        d.status::text as status,
        d.payload_json,
        d.error_json,
        d.created_at,
        d.sent_at,
        rr.payload_json->'inbox'->>'readAt' as read_at
      from notification_dispatches d
      left join notification_dispatches rr
        on rr.tenant_id = d.tenant_id
        and rr.membership_id = d.membership_id
        and rr.template_key = '__inbox_read__'
        and rr.payload_json->>'readForDispatchId' = d.id::text
      where d.tenant_id = ${args.tenantId}::uuid
        and d.membership_id = ${args.membershipId}::uuid
        and d.channel = 'in_app'
        and d.status = 'SENT'::"DispatchStatus"
        and d.template_key <> '__inbox_read__'
      order by d.created_at desc
      limit ${args.limit}
    `;
  },

  async findCertificateMembershipId(tx: TenantTx, certificateId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string | null }>>`
      select membership_id::text
      from certificates
      where id = ${certificateId}::uuid
      limit 1
    `;
    return rows[0]?.membership_id ?? null;
  },

  async findMembershipEmail(tx: TenantTx, membershipId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ email: string | null }>>`
      select ap.email
      from memberships m
      join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0]?.email ?? null;
  },
};
