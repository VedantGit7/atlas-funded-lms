import type { TenantTx } from "@atlas/db";
import type { ReferralWalletQuery } from "./sales-marketing-roster.dto";
import type { ReferralWalletRow } from "./sales-marketing-roster.repository";
import { asUnknownString } from "./sales-marketing-roster.repository-helpers";

/**
 * The referral wallet and one referrer's referred learners.
 * Part of salesMarketingRosterRepository.
 */
export const salesMarketingRosterReferralsRepository = {
  async countReferralWallet(tx: TenantTx, query: ReferralWalletQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from (
        select
          rc.membership_id,
          (
            select count(*)::int from sales_referral_attributions a
            where a.referrer_membership_id = rc.membership_id
              and a.signup_credited_at is not null
          ) as successful_referrals,
          (
            select coalesce(sum(t.credits), 0)::int
            from sales_wallet_transactions t
            where t.membership_id = rc.membership_id
              and t.direction = 'CREDIT'
              and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
          ) as credit_earned,
          coalesce(w.balance_credits, 0) as wallet_balance,
          coalesce(m.created_at, rc.created_at) as signed_up_at
        from sales_referral_codes rc
        left join sales_wallets w
          on w.membership_id = rc.membership_id and w.tenant_id = rc.tenant_id
        left join memberships m
          on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where rc.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(rc.code, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
      ) ranked
      where (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or ranked.signed_up_at >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or ranked.signed_up_at <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${query.minCreditEarned ?? null}::int is null
          or ranked.credit_earned >= ${query.minCreditEarned ?? null}::int
        )
        and (
          ${query.minWalletBalance ?? null}::int is null
          or ranked.wallet_balance >= ${query.minWalletBalance ?? null}::int
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listReferralWallet(tx: TenantTx, query: ReferralWalletQuery): Promise<ReferralWalletRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from (
        select
          rc.membership_id::text as membership_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          rc.code as referral_code,
          (
            select count(*)::int from sales_referral_attributions a
            where a.referrer_membership_id = rc.membership_id
              and a.signup_credited_at is not null
          ) as successful_referrals,
          (
            select coalesce(sum(t.credits), 0)::int
            from sales_wallet_transactions t
            where t.membership_id = rc.membership_id
              and t.direction = 'CREDIT'
              and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
          ) as credit_earned,
          coalesce(w.balance_credits, 0)::int as wallet_balance,
          coalesce((
            select sum(po.amount_cents)::int
            from sales_referral_purchase_credits rpc
            join payment_orders po
              on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
            where rpc.referrer_membership_id = rc.membership_id
              and po.status = 'paid'
          ), 0)::int as referred_revenue_cents,
          coalesce(m.created_at, rc.created_at) as signed_up_at
        from sales_referral_codes rc
        left join sales_wallets w
          on w.membership_id = rc.membership_id and w.tenant_id = rc.tenant_id
        left join memberships m
          on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where rc.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(rc.code, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.q ?? null}) || '%'
          )
      ) ranked
      where (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or ranked.signed_up_at >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or ranked.signed_up_at <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${query.minCreditEarned ?? null}::int is null
          or ranked.credit_earned >= ${query.minCreditEarned ?? null}::int
        )
        and (
          ${query.minWalletBalance ?? null}::int is null
          or ranked.wallet_balance >= ${query.minWalletBalance ?? null}::int
        )
      order by
        case when ${query.sortBy} = 'successful_referrals' and ${query.sortDir} = 'asc' then ranked.successful_referrals end asc,
        case when ${query.sortBy} = 'successful_referrals' and ${query.sortDir} = 'desc' then ranked.successful_referrals end desc,
        case when ${query.sortBy} = 'credit_earned' and ${query.sortDir} = 'asc' then ranked.credit_earned end asc,
        case when ${query.sortBy} = 'credit_earned' and ${query.sortDir} = 'desc' then ranked.credit_earned end desc,
        case when ${query.sortBy} = 'wallet_balance' and ${query.sortDir} = 'asc' then ranked.wallet_balance end asc,
        case when ${query.sortBy} = 'wallet_balance' and ${query.sortDir} = 'desc' then ranked.wallet_balance end desc,
        case when ${query.sortBy} = 'referred_revenue_cents' and ${query.sortDir} = 'asc' then ranked.referred_revenue_cents end asc,
        case when ${query.sortBy} = 'referred_revenue_cents' and ${query.sortDir} = 'desc' then ranked.referred_revenue_cents end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then ranked.learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then ranked.learner_name end desc nulls last,
        case when ${query.sortBy} = 'signed_up_at' and ${query.sortDir} = 'asc' then ranked.signed_up_at end asc nulls last,
        case when ${query.sortBy} = 'signed_up_at' and ${query.sortDir} = 'desc' then ranked.signed_up_at end desc nulls last,
        ranked.successful_referrals desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => ({
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      referral_code: typeof row["referral_code"] === "string" ? row["referral_code"] : null,
      successful_referrals: Number(row["successful_referrals"] ?? 0),
      credit_earned: Number(row["credit_earned"] ?? 0),
      wallet_balance: Number(row["wallet_balance"] ?? 0),
      referred_revenue_cents: Number(row["referred_revenue_cents"] ?? 0),
      signed_up_at: row["signed_up_at"] instanceof Date ? row["signed_up_at"] : null,
    }));
  },

  async getReferralWalletSummary(
    tx: TenantTx,
    windowFrom: string,
    windowTo: string,
    previousFrom: string,
    previousTo: string,
  ): Promise<{
    successful_referrals: number;
    previous_successful_referrals: number;
    credit_earned: number;
    credit_outstanding: number;
    wallets_with_balance: number;
    referred_revenue_cents: number;
    referrer_count: number;
    total_learners: number;
    currency: string;
  }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        (
          select count(*)::int
          from sales_referral_attributions a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.signup_credited_at is not null
            and a.created_at >= ${windowFrom}::timestamptz
            and a.created_at <= ${windowTo}::timestamptz
        ) as successful_referrals,
        (
          select count(*)::int
          from sales_referral_attributions a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.signup_credited_at is not null
            and a.created_at >= ${previousFrom}::timestamptz
            and a.created_at <= ${previousTo}::timestamptz
        ) as previous_successful_referrals,
        (
          select coalesce(sum(t.credits), 0)::int
          from sales_wallet_transactions t
          where t.tenant_id = current_setting('app.tenant_id', true)::uuid
            and t.direction = 'CREDIT'
            and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
            and t.created_at >= ${windowFrom}::timestamptz
            and t.created_at <= ${windowTo}::timestamptz
        ) as credit_earned,
        (
          select coalesce(sum(w.balance_credits), 0)::int
          from sales_wallets w
          where w.tenant_id = current_setting('app.tenant_id', true)::uuid
            and w.balance_credits > 0
        ) as credit_outstanding,
        (
          select count(*)::int
          from sales_wallets w
          where w.tenant_id = current_setting('app.tenant_id', true)::uuid
            and w.balance_credits > 0
        ) as wallets_with_balance,
        (
          select coalesce(sum(po.amount_cents), 0)::int
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.tenant_id = current_setting('app.tenant_id', true)::uuid
            and po.status = 'paid'
            and coalesce(po.paid_at, po.created_at) >= ${windowFrom}::timestamptz
            and coalesce(po.paid_at, po.created_at) <= ${windowTo}::timestamptz
        ) as referred_revenue_cents,
        (
          select count(distinct a.referrer_membership_id)::int
          from sales_referral_attributions a
          where a.tenant_id = current_setting('app.tenant_id', true)::uuid
            and a.signup_credited_at is not null
            and a.created_at >= ${windowFrom}::timestamptz
            and a.created_at <= ${windowTo}::timestamptz
        ) as referrer_count,
        (
          select count(*)::int
          from memberships m
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and m.removed_at is null
            and m.archived_at is null
        ) as total_learners,
        (
          select coalesce(
            (
              select upper(po.currency)
              from sales_referral_purchase_credits rpc
              join payment_orders po
                on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
              where rpc.tenant_id = current_setting('app.tenant_id', true)::uuid
                and po.status = 'paid'
              order by coalesce(po.paid_at, po.created_at) desc
              limit 1
            ),
            'INR'
          )
        ) as currency
    `;
    const row = rows[0] ?? {};
    return {
      successful_referrals: Number(row["successful_referrals"] ?? 0),
      previous_successful_referrals: Number(row["previous_successful_referrals"] ?? 0),
      credit_earned: Number(row["credit_earned"] ?? 0),
      credit_outstanding: Number(row["credit_outstanding"] ?? 0),
      wallets_with_balance: Number(row["wallets_with_balance"] ?? 0),
      referred_revenue_cents: Number(row["referred_revenue_cents"] ?? 0),
      referrer_count: Number(row["referrer_count"] ?? 0),
      total_learners: Number(row["total_learners"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
    };
  },

  async findReferrer(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{
    membership_id: string;
    learner_name: string | null;
    email: string | null;
    referral_code: string | null;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        rc.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        rc.code as referral_code
      from sales_referral_codes rc
      left join memberships m
        on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where rc.membership_id = ${membershipId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membership_id: asUnknownString(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      referral_code: typeof row["referral_code"] === "string" ? row["referral_code"] : null,
    };
  },

  async countReferredLearners(tx: TenantTx, referrerMembershipId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from sales_referral_attributions a
      where a.referrer_membership_id = ${referrerMembershipId}::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listReferredLearners(
    tx: TenantTx,
    referrerMembershipId: string,
    query: { page: number; limit: number },
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      signed_up_at: Date;
      first_purchase_title: string | null;
      revenue_attributed_cents: number;
      credit_awarded: number;
      currency: string;
      status: "QUALIFIED" | "PENDING" | "DISQUALIFIED";
    }>
  > {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.referee_membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        a.created_at as signed_up_at,
        (
          select po.product_title
          from payment_orders po
          where po.membership_id = a.referee_membership_id
            and po.tenant_id = a.tenant_id
            and po.status = 'paid'
          order by coalesce(po.paid_at, po.created_at) asc
          limit 1
        ) as first_purchase_title,
        coalesce((
          select sum(po.amount_cents)::int
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.attribution_id = a.id
            and po.status = 'paid'
        ), 0)::int as revenue_attributed_cents,
        coalesce((
          select sum(rpc.credits_applied)::int
          from sales_referral_purchase_credits rpc
          where rpc.attribution_id = a.id
        ), 0)::int as credit_awarded,
        coalesce((
          select upper(po.currency)
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.attribution_id = a.id
            and po.status = 'paid'
          order by coalesce(po.paid_at, po.created_at) desc
          limit 1
        ), 'INR') as currency,
        case
          when not exists (
            select 1 from payment_orders po
            where po.membership_id = a.referee_membership_id
              and po.tenant_id = a.tenant_id
              and po.status = 'paid'
          ) then 'PENDING'
          when exists (
            select 1 from sales_referral_purchase_credits rpc
            where rpc.attribution_id = a.id and rpc.credits_applied > 0
          ) or a.signup_credited_at is not null then 'QUALIFIED'
          else 'DISQUALIFIED'
        end as status
      from sales_referral_attributions a
      join memberships m on m.id = a.referee_membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.referrer_membership_id = ${referrerMembershipId}::uuid
      order by a.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map((row) => {
      const statusRaw = asUnknownString(row["status"], "PENDING");
      const status =
        statusRaw === "QUALIFIED" || statusRaw === "DISQUALIFIED" ? statusRaw : "PENDING";
      return {
        membership_id: asUnknownString(row["membership_id"]),
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        signed_up_at: row["signed_up_at"] as Date,
        first_purchase_title:
          typeof row["first_purchase_title"] === "string" ? row["first_purchase_title"] : null,
        revenue_attributed_cents: Number(row["revenue_attributed_cents"] ?? 0),
        credit_awarded: Number(row["credit_awarded"] ?? 0),
        currency: asUnknownString(row["currency"], "INR"),
        status,
      };
    });
  },

  async getReferrerDrilldownTotals(
    tx: TenantTx,
    referrerMembershipId: string,
  ): Promise<{ total_credit_awarded: number; total_revenue_cents: number; currency: string }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce((
          select sum(rpc.credits_applied)::int
          from sales_referral_purchase_credits rpc
          where rpc.referrer_membership_id = ${referrerMembershipId}::uuid
        ), 0)::int as total_credit_awarded,
        coalesce((
          select sum(po.amount_cents)::int
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.referrer_membership_id = ${referrerMembershipId}::uuid
            and po.status = 'paid'
        ), 0)::int as total_revenue_cents,
        coalesce((
          select upper(po.currency)
          from sales_referral_purchase_credits rpc
          join payment_orders po
            on po.id = rpc.payment_order_id and po.tenant_id = rpc.tenant_id
          where rpc.referrer_membership_id = ${referrerMembershipId}::uuid
            and po.status = 'paid'
          order by coalesce(po.paid_at, po.created_at) desc
          limit 1
        ), 'INR') as currency
    `;
    const row = rows[0] ?? {};
    return {
      total_credit_awarded: Number(row["total_credit_awarded"] ?? 0),
      total_revenue_cents: Number(row["total_revenue_cents"] ?? 0),
      currency: asUnknownString(row["currency"], "INR"),
    };
  },
};
