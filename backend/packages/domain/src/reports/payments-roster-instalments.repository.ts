import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { PaymentInstalmentsQuery } from "./payments-roster.dto";
import { textColumn } from "./raw-column";
import type {
  PaymentInstalmentPlanRow,
  PaymentInstalmentScheduleRow,
  PaymentInstalmentsFilter,
} from "./payments-roster.repository";
import { asDate, asIntOrNull } from "./payments-roster.repository-helpers";

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapPlan(row: Record<string, unknown>): PaymentInstalmentPlanRow {
  return {
    id: textColumn(row["id"]),
    membership_id: textColumn(row["membership_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    product_title: textColumn(row["product_title"]),
    product_type: textColumn(row["product_type"], "course"),
    pricing_plan_label:
      typeof row["pricing_plan_label"] === "string" ? row["pricing_plan_label"] : null,
    total_amount_cents: Number(row["total_amount_cents"]),
    remaining_amount_cents: Number(row["remaining_amount_cents"]),
    currency: textColumn(row["currency"]),
    status: textColumn(row["status"]),
    created_at: asDate(row["created_at"]) ?? new Date(0),
    next_due_at: asDate(row["next_due_at"]),
    instalment_count: asIntOrNull(row["instalment_count"]) ?? 0,
    paid_count: asIntOrNull(row["paid_count"]) ?? 0,
    overdue_count: asIntOrNull(row["overdue_count"]) ?? 0,
    metadata_json: asJsonObject(row["metadata_json"]),
  };
}

/**
 * Instalment plans: the list, one plan, its schedule, and changes to it.
 * Part of paymentsRosterRepository.
 */
export const paymentsRosterInstalmentsRepository = {
  async countInstalmentPlans(tx: TenantTx, filter: PaymentInstalmentsFilter): Promise<number> {
    const status = filter.status ?? null;
    const nextDue = filter.nextDue ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${status}::text is null
          or (
            ${status} = 'overdue'
            and (
              p.status = 'overdue'
              or exists (
                select 1 from payment_instalments pi
                where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                  and (
                    pi.status = 'overdue'
                    or (pi.status = 'scheduled' and pi.due_at < now())
                  )
              )
            )
          )
          or (
            ${status} <> 'overdue'
            and p.status = ${status}
          )
        )
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and (
          ${filter.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
          or lower(p.product_title) like '%' || lower(${filter.q ?? null}) || '%'
          or lower(coalesce(p.pricing_plan_label, '')) like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.productTitle ?? null}::text is null
          or lower(p.product_title) like '%' || lower(${filter.productTitle ?? null}) || '%'
        )
        and (
          ${filter.pricingPlanLabel ?? null}::text is null
          or lower(coalesce(p.pricing_plan_label, ''))
            like '%' || lower(${filter.pricingPlanLabel ?? null}) || '%'
        )
        and (
          ${nextDue}::text is null
          or (
            ${nextDue} = 'overdue'
            and exists (
              select 1 from payment_instalments pi
              where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                and (
                  pi.status = 'overdue'
                  or (pi.status = 'scheduled' and pi.due_at < now())
                )
            )
          )
          or (
            ${nextDue} = '7days'
            and exists (
              select 1 from payment_instalments pi
              where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                and pi.status in ('scheduled', 'overdue')
                and pi.due_at >= now()
                and pi.due_at < now() + interval '7 days'
            )
          )
          or (
            ${nextDue} = '30days'
            and exists (
              select 1 from payment_instalments pi
              where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
                and pi.status in ('scheduled', 'overdue')
                and pi.due_at >= now()
                and pi.due_at < now() + interval '30 days'
            )
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listInstalmentPlans(
    tx: TenantTx,
    query: PaymentInstalmentsQuery,
  ): Promise<PaymentInstalmentPlanRow[]> {
    const skip = (query.page - 1) * query.limit;
    const status = query.status ?? null;
    const nextDue = query.nextDue ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        p.product_title,
        p.product_type,
        p.pricing_plan_label,
        p.total_amount_cents,
        p.remaining_amount_cents,
        p.currency,
        p.status,
        p.metadata_json,
        p.created_at,
        stats.next_due_at,
        coalesce(stats.instalment_count, 0)::int as instalment_count,
        coalesce(stats.paid_count, 0)::int as paid_count,
        coalesce(stats.overdue_count, 0)::int as overdue_count
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join lateral (
        select
          min(pi.due_at) filter (
            where pi.status in ('scheduled', 'overdue')
          ) as next_due_at,
          count(*)::int as instalment_count,
          count(*) filter (where pi.status = 'paid')::int as paid_count,
          count(*) filter (
            where pi.status = 'overdue'
              or (pi.status = 'scheduled' and pi.due_at < now())
          )::int as overdue_count
        from payment_instalments pi
        where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
      ) stats on true
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${status}::text is null
          or (
            ${status} = 'overdue'
            and (
              p.status = 'overdue'
              or coalesce(stats.overdue_count, 0) > 0
            )
          )
          or (
            ${status} <> 'overdue'
            and p.status = ${status}
          )
        )
        and (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (
          ${query.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.email ?? null}) || '%'
        )
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
          or lower(p.product_title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(p.pricing_plan_label, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.productTitle ?? null}::text is null
          or lower(p.product_title) like '%' || lower(${query.productTitle ?? null}) || '%'
        )
        and (
          ${query.pricingPlanLabel ?? null}::text is null
          or lower(coalesce(p.pricing_plan_label, ''))
            like '%' || lower(${query.pricingPlanLabel ?? null}) || '%'
        )
        and (
          ${nextDue}::text is null
          or (
            ${nextDue} = 'overdue'
            and coalesce(stats.overdue_count, 0) > 0
          )
          or (
            ${nextDue} = '7days'
            and stats.next_due_at is not null
            and stats.next_due_at >= now()
            and stats.next_due_at < now() + interval '7 days'
          )
          or (
            ${nextDue} = '30days'
            and stats.next_due_at is not null
            and stats.next_due_at >= now()
            and stats.next_due_at < now() + interval '30 days'
          )
        )
      order by
        case when ${query.sortBy} = 'remaining_amount_cents' and ${query.sortDir} = 'asc'
          then p.remaining_amount_cents end asc,
        case when ${query.sortBy} = 'remaining_amount_cents' and ${query.sortDir} = 'desc'
          then p.remaining_amount_cents end desc,
        case when ${query.sortBy} = 'total_amount_cents' and ${query.sortDir} = 'asc'
          then p.total_amount_cents end asc,
        case when ${query.sortBy} = 'total_amount_cents' and ${query.sortDir} = 'desc'
          then p.total_amount_cents end desc,
        case when ${query.sortBy} = 'next_due_at' and ${query.sortDir} = 'asc'
          then stats.next_due_at end asc nulls last,
        case when ${query.sortBy} = 'next_due_at' and ${query.sortDir} = 'desc'
          then stats.next_due_at end desc nulls last,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'asc' then p.created_at end asc,
        case when ${query.sortBy} = 'created_at' and ${query.sortDir} = 'desc' then p.created_at end desc,
        p.id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapPlan);
  },

  async getInstalmentLedgerSummary(tx: TenantTx): Promise<{
    currency: string;
    outstanding_cents: number;
    outstanding_plan_count: number;
    due_next_7_days_cents: number;
    overdue_cents: number;
    overdue_instalment_count: number;
    completed_this_month_count: number;
  }> {
    const [outstanding, dueSoon, overdue, completed, currencyRow] = await Promise.all([
      tx.$queryRaw<Array<{ remaining_cents: bigint; plan_count: bigint }>>`
        select
          coalesce(sum(p.remaining_amount_cents), 0)::bigint as remaining_cents,
          count(*)::bigint as plan_count
        from payment_instalment_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.status in ('active', 'overdue')
          and p.remaining_amount_cents > 0
      `,
      tx.$queryRaw<Array<{ amount_cents: bigint }>>`
        select coalesce(sum(pi.amount_cents), 0)::bigint as amount_cents
        from payment_instalments pi
        join payment_instalment_plans p on p.id = pi.plan_id and p.tenant_id = pi.tenant_id
        where pi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and pi.status in ('scheduled', 'overdue')
          and pi.due_at >= now()
          and pi.due_at < now() + interval '7 days'
      `,
      tx.$queryRaw<Array<{ amount_cents: bigint; instalment_count: bigint }>>`
        select
          coalesce(sum(pi.amount_cents), 0)::bigint as amount_cents,
          count(*)::bigint as instalment_count
        from payment_instalments pi
        join payment_instalment_plans p on p.id = pi.plan_id and p.tenant_id = pi.tenant_id
        where pi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            pi.status = 'overdue'
            or (pi.status = 'scheduled' and pi.due_at < now())
          )
      `,
      tx.$queryRaw<Array<{ plan_count: bigint }>>`
        select count(*)::bigint as plan_count
        from payment_instalment_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.status = 'completed'
          and p.updated_at >= date_trunc('month', now())
      `,
      tx.$queryRaw<Array<{ currency: string | null }>>`
        select p.currency
        from payment_instalment_plans p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.status in ('active', 'overdue')
          and p.remaining_amount_cents > 0
        order by p.updated_at desc
        limit 1
      `,
    ]);

    return {
      currency: currencyRow[0]?.currency ?? "USD",
      outstanding_cents: Number(outstanding[0]?.remaining_cents ?? 0),
      outstanding_plan_count: Number(outstanding[0]?.plan_count ?? 0),
      due_next_7_days_cents: Number(dueSoon[0]?.amount_cents ?? 0),
      overdue_cents: Number(overdue[0]?.amount_cents ?? 0),
      overdue_instalment_count: Number(overdue[0]?.instalment_count ?? 0),
      completed_this_month_count: Number(completed[0]?.plan_count ?? 0),
    };
  },

  async findInstalmentPlan(tx: TenantTx, planId: string): Promise<PaymentInstalmentPlanRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        p.product_title,
        p.product_type,
        p.pricing_plan_label,
        p.total_amount_cents,
        p.remaining_amount_cents,
        p.currency,
        p.status,
        p.metadata_json,
        p.created_at,
        stats.next_due_at,
        coalesce(stats.instalment_count, 0)::int as instalment_count,
        coalesce(stats.paid_count, 0)::int as paid_count,
        coalesce(stats.overdue_count, 0)::int as overdue_count
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join lateral (
        select
          min(pi.due_at) filter (
            where pi.status in ('scheduled', 'overdue')
          ) as next_due_at,
          count(*)::int as instalment_count,
          count(*) filter (where pi.status = 'paid')::int as paid_count,
          count(*) filter (
            where pi.status = 'overdue'
              or (pi.status = 'scheduled' and pi.due_at < now())
          )::int as overdue_count
        from payment_instalments pi
        where pi.plan_id = p.id and pi.tenant_id = p.tenant_id
      ) stats on true
      where p.id = ${planId}::uuid
      limit 1
    `;
    return rows[0] ? mapPlan(rows[0]) : null;
  },

  async listInstalmentSchedule(
    tx: TenantTx,
    planId: string,
  ): Promise<PaymentInstalmentScheduleRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        sequence_no,
        amount_cents,
        due_at,
        paid_at,
        status,
        payment_order_id::text as payment_order_id
      from payment_instalments
      where plan_id = ${planId}::uuid
      order by sequence_no asc
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      sequence_no: Number(row["sequence_no"]),
      amount_cents: Number(row["amount_cents"]),
      due_at: row["due_at"] as Date,
      paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
      status: textColumn(row["status"]),
      payment_order_id:
        typeof row["payment_order_id"] === "string" ? row["payment_order_id"] : null,
    }));
  },

  async insertInstalmentPlan(
    tx: TenantTx,
    args: {
      membershipId: string;
      productTitle: string;
      productType: string;
      pricingPlanLabel?: string | null;
      totalAmountCents: number;
      currency: string;
      instalments: Array<{ amountCents: number; dueAt: string }>;
      metadataJson?: Record<string, unknown> | null;
    },
  ): Promise<PaymentInstalmentPlanRow> {
    const planId = randomUUID();
    await tx.$executeRaw`
      insert into payment_instalment_plans (
        id, tenant_id, membership_id, product_title, product_type, pricing_plan_label,
        total_amount_cents, currency, remaining_amount_cents, status, metadata_json,
        created_at, updated_at
      ) values (
        ${planId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.membershipId}::uuid,
        ${args.productTitle},
        ${args.productType},
        ${args.pricingPlanLabel ?? null},
        ${args.totalAmountCents},
        ${args.currency},
        ${args.totalAmountCents},
        'active',
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        now(),
        now()
      )
    `;

    let sequence = 1;
    for (const instalment of args.instalments) {
      await tx.$executeRaw`
        insert into payment_instalments (
          id, tenant_id, plan_id, sequence_no, amount_cents, due_at, status, created_at, updated_at
        ) values (
          ${randomUUID()}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${planId}::uuid,
          ${sequence},
          ${instalment.amountCents},
          ${instalment.dueAt}::timestamptz,
          'scheduled',
          now(),
          now()
        )
      `;
      sequence += 1;
    }

    const plan = await this.findInstalmentPlan(tx, planId);
    if (!plan) throw new Error("INSTALMENT_PLAN_INSERT_FAILED");
    return plan;
  },

  async findNextPayableInstalment(
    tx: TenantTx,
    planId: string,
    instalmentId?: string,
  ): Promise<PaymentInstalmentScheduleRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        sequence_no,
        amount_cents,
        due_at,
        paid_at,
        status,
        payment_order_id::text as payment_order_id
      from payment_instalments
      where plan_id = ${planId}::uuid
        and status in ('scheduled', 'overdue')
        and (${instalmentId ?? null}::uuid is null or id = ${instalmentId ?? null}::uuid)
      order by sequence_no asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: textColumn(row["id"]),
      sequence_no: Number(row["sequence_no"]),
      amount_cents: Number(row["amount_cents"]),
      due_at: row["due_at"] as Date,
      paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
      status: textColumn(row["status"]),
      payment_order_id:
        typeof row["payment_order_id"] === "string" ? row["payment_order_id"] : null,
    };
  },

  async markInstalmentPaid(
    tx: TenantTx,
    args: {
      planId: string;
      instalmentId: string;
      paymentOrderId: string;
      amountCents: number;
      paidAt?: Date;
    },
  ): Promise<{ remaining_amount_cents: number; status: string }> {
    const paidAt = args.paidAt ?? new Date();
    await tx.$executeRaw`
      update payment_instalments
      set
        status = 'paid',
        paid_at = ${paidAt}::timestamptz,
        payment_order_id = ${args.paymentOrderId}::uuid,
        updated_at = now()
      where id = ${args.instalmentId}::uuid
        and plan_id = ${args.planId}::uuid
    `;

    const rows = await tx.$queryRaw<Array<{ remaining_amount_cents: number; status: string }>>`
      update payment_instalment_plans
      set
        remaining_amount_cents = greatest(remaining_amount_cents - ${args.amountCents}, 0),
        status = case
          when greatest(remaining_amount_cents - ${args.amountCents}, 0) = 0 then 'completed'
          when status = 'overdue' then 'active'
          else status
        end,
        updated_at = now()
      where id = ${args.planId}::uuid
      returning remaining_amount_cents, status
    `;
    const updated = rows[0];
    if (!updated) throw new Error("INSTALMENT_PLAN_UPDATE_FAILED");
    return updated;
  },

  async cancelInstalmentPlan(
    tx: TenantTx,
    args: {
      planId: string;
      reason: string;
      accessOption: "keep" | "revoke";
      cancelledAt: string;
      cancelledByMembershipId: string | null;
    },
  ): Promise<{
    status: string;
    voided_instalment_count: number;
    metadata_json: Record<string, unknown> | null;
  } | null> {
    const existing = await this.findInstalmentPlan(tx, args.planId);
    if (!existing) return null;

    const nextMeta = {
      ...(existing.metadata_json ?? {}),
      planCancel: {
        cancelledAt: args.cancelledAt,
        reason: args.reason,
        accessOption: args.accessOption,
        cancelledByMembershipId: args.cancelledByMembershipId,
        accessNote:
          args.accessOption === "revoke"
            ? "Revoke requested — course access is not automated yet; follow up in memberships if needed."
            : "Course access left unchanged.",
      },
    };

    const voided = await tx.$queryRaw<Array<{ count: bigint }>>`
      with voided as (
        update payment_instalments
        set
          status = 'cancelled',
          updated_at = now()
        where plan_id = ${args.planId}::uuid
          and status in ('scheduled', 'overdue')
        returning id
      )
      select count(*)::bigint as count from voided
    `;

    const rows = await tx.$queryRaw<Array<{ status: string; metadata_json: unknown }>>`
      update payment_instalment_plans
      set
        status = 'cancelled',
        metadata_json = ${JSON.stringify(nextMeta)}::jsonb,
        updated_at = now()
      where id = ${args.planId}::uuid
        and status in ('active', 'overdue')
      returning status, metadata_json
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      status: row.status,
      voided_instalment_count: Number(voided[0]?.count ?? 0),
      metadata_json: asJsonObject(row.metadata_json),
    };
  },
};
