import type { TenantTx } from "@atlas/db";
import { textColumn } from "./raw-column";

/**
 * One learner's custom field values and their history.
 * Part of customFieldRosterRepository.
 */
export const customFieldRosterLearnerDetailRepository = {
  async findLearnerSummary(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{
    membership_id: string;
    learner_name: string | null;
    email: string | null;
    status: string;
    avatar_url: string | null;
    enrollment_count: number;
    total_spent_cents: number;
    currency: string;
    last_active_at: Date | null;
    signed_up_at: Date | null;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        m.id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        m.status::text as status,
        mp.avatar_key as avatar_url,
        (
          select count(*)::int from enrollments e
          where e.membership_id = m.id and e.tenant_id = m.tenant_id
        ) as enrollment_count,
        coalesce((
          select sum(po.amount_cents)::int from payment_orders po
          where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
        ), 0) as total_spent_cents,
        coalesce((
          select po.currency from payment_orders po
          where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          order by po.paid_at desc nulls last
          limit 1
        ), 'INR') as currency,
        m.last_active_at,
        coalesce(m.joined_at, m.created_at) as signed_up_at
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.id = ${membershipId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membership_id: textColumn(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : textColumn(row["learner_name"]),
      email: row["email"] == null ? null : textColumn(row["email"]),
      status: textColumn(row["status"], ""),
      avatar_url: row["avatar_url"] == null ? null : textColumn(row["avatar_url"]),
      enrollment_count: Number(row["enrollment_count"] ?? 0),
      total_spent_cents: Number(row["total_spent_cents"] ?? 0),
      currency: textColumn(row["currency"], "INR"),
      last_active_at:
        row["last_active_at"] instanceof Date
          ? row["last_active_at"]
          : row["last_active_at"]
            ? new Date(textColumn(row["last_active_at"]))
            : null,
      signed_up_at:
        row["signed_up_at"] instanceof Date
          ? row["signed_up_at"]
          : row["signed_up_at"]
            ? new Date(textColumn(row["signed_up_at"]))
            : null,
    };
  },

  async listLearnerFieldValues(
    tx: TenantTx,
    membershipId: string,
  ): Promise<
    Array<{
      definition_id: string;
      key: string;
      label: string;
      field_type: string;
      status: string;
      options_json: unknown;
      value_json: unknown;
      updated_at: Date | null;
      updated_by_membership_id: string | null;
      updated_by_name: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        d.id::text as definition_id,
        d.key,
        d.label,
        d.field_type,
        d.status::text as status,
        d.options_json,
        cfv.value_json,
        cfv.updated_at,
        cfv.updated_by_membership_id::text as updated_by_membership_id,
        coalesce(ump.display_name, uap.email, um.invited_email_normalized) as updated_by_name
      from custom_field_definitions d
      left join custom_field_values cfv
        on cfv.custom_field_definition_id = d.id
        and cfv.tenant_id = d.tenant_id
        and cfv.membership_id = ${membershipId}::uuid
      left join memberships um
        on um.id = cfv.updated_by_membership_id and um.tenant_id = d.tenant_id
      left join member_profiles ump
        on ump.membership_id = um.id and ump.tenant_id = um.tenant_id and ump.deleted_at is null
      left join auth_principals uap on uap.id = um.auth_principal_id
      where d.tenant_id = current_setting('app.tenant_id', true)::uuid
        and d.status::text in ('ACTIVE', 'INACTIVE', 'ARCHIVED')
      order by d.created_at asc, d.key asc
    `;
    return rows.map((row) => ({
      definition_id: textColumn(row["definition_id"]),
      key: textColumn(row["key"]),
      label: textColumn(row["label"]),
      field_type: textColumn(row["field_type"]),
      status: textColumn(row["status"]),
      options_json: row["options_json"],
      value_json: row["value_json"] ?? null,
      updated_at:
        row["updated_at"] instanceof Date
          ? row["updated_at"]
          : row["updated_at"]
            ? new Date(textColumn(row["updated_at"]))
            : null,
      updated_by_membership_id:
        row["updated_by_membership_id"] == null
          ? null
          : textColumn(row["updated_by_membership_id"]),
      updated_by_name: row["updated_by_name"] == null ? null : textColumn(row["updated_by_name"]),
    }));
  },

  async listLearnerFieldHistory(
    tx: TenantTx,
    membershipId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      definition_id: string;
      field_key: string;
      field_label: string;
      field_type: string;
      old_value_json: unknown;
      new_value_json: unknown;
      changed_at: Date;
      changed_by_name: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        h.id::text as id,
        h.custom_field_definition_id::text as definition_id,
        d.key as field_key,
        d.label as field_label,
        d.field_type,
        h.old_value_json,
        h.new_value_json,
        h.changed_at,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as changed_by_name
      from custom_field_value_history h
      join custom_field_definitions d
        on d.id = h.custom_field_definition_id and d.tenant_id = h.tenant_id
      left join memberships m
        on m.id = h.changed_by_membership_id and m.tenant_id = h.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where h.tenant_id = current_setting('app.tenant_id', true)::uuid
        and h.membership_id = ${membershipId}::uuid
      order by h.changed_at desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      definition_id: textColumn(row["definition_id"]),
      field_key: textColumn(row["field_key"]),
      field_label: textColumn(row["field_label"]),
      field_type: textColumn(row["field_type"]),
      old_value_json: row["old_value_json"] ?? null,
      new_value_json: row["new_value_json"] ?? null,
      changed_at:
        row["changed_at"] instanceof Date
          ? row["changed_at"]
          : new Date(textColumn(row["changed_at"])),
      changed_by_name: row["changed_by_name"] == null ? null : textColumn(row["changed_by_name"]),
    }));
  },
};
