import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type AffiliateConfigRow = {
  id: string;
  enabled: boolean;
  access_mode: string;
  ask_admin: boolean;
  standard_discount_pct: number;
  standard_commission_pct: number;
  premium_discount_pct: number;
  premium_commission_pct: number;
  updated_at: Date;
};

export type AffiliateRow = {
  id: string;
  membership_id: string;
  tier: string;
  status: string;
  coupon_code: string;
  payout_upi: string | null;
  payout_bank_account: string | null;
  payout_ifsc: string | null;
  payout_account_name: string | null;
  created_by_membership_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AffiliateListRow = AffiliateRow & {
  display_name: string | null;
  email: string | null;
  unpaid_cents: number;
  paid_cents: number;
};

export type AffiliateProductRow = {
  id: string;
  course_id: string;
  enabled: boolean;
  standard_discount_pct: number | null;
  standard_commission_pct: number | null;
  premium_discount_pct: number | null;
  premium_commission_pct: number | null;
  created_at: Date;
  updated_at: Date;
};

export type AffiliateProductListRow = AffiliateProductRow & {
  course_title: string | null;
};

export type AffiliateRequestRow = {
  id: string;
  membership_id: string;
  status: string;
  note: string | null;
  reviewed_by_membership_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type AffiliateRequestListRow = AffiliateRequestRow & {
  display_name: string | null;
  email: string | null;
};

export type AffiliateCommissionRow = {
  id: string;
  affiliate_id: string;
  affiliate_membership_id: string;
  buyer_membership_id: string;
  course_id: string;
  payment_order_id: string;
  coupon_code_snapshot: string;
  tier_snapshot: string;
  order_amount_cents: number;
  discount_cents: number;
  commission_cents: number;
  currency: string;
  status: string;
  payout_id: string | null;
  created_at: Date;
};

export type AffiliatePayoutRow = {
  id: string;
  affiliate_id: string;
  affiliate_membership_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  note: string | null;
  marked_by_membership_id: string | null;
  paid_at: Date;
  created_at: Date;
};

export type AffiliatePayoutListRow = AffiliatePayoutRow & {
  display_name: string | null;
  email: string | null;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeAffiliateCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export function generateAffiliateCouponCode(): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return out;
}

export const salesAffiliatesRepository = {
  async getConfig(tx: TenantTx): Promise<AffiliateConfigRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateConfigRow[]>(
      `
      select id::text, enabled, access_mode, ask_admin,
             standard_discount_pct, standard_commission_pct,
             premium_discount_pct, premium_commission_pct, updated_at
      from sales_affiliate_configs
      limit 1
      `,
    );
    return rows[0] ?? null;
  },

  async upsertConfig(
    tx: TenantTx,
    args: {
      enabled: boolean;
      accessMode: string;
      askAdmin: boolean;
      standardDiscountPct: number;
      standardCommissionPct: number;
      premiumDiscountPct: number;
      premiumCommissionPct: number;
      updatedByMembershipId: string;
    },
  ) {
    const existing = await this.getConfig(tx);
    if (existing) {
      await tx.$executeRawUnsafe(
        `
        update sales_affiliate_configs
        set enabled = $1,
            access_mode = $2,
            ask_admin = $3,
            standard_discount_pct = $4,
            standard_commission_pct = $5,
            premium_discount_pct = $6,
            premium_commission_pct = $7,
            updated_by_membership_id = $8::uuid,
            updated_at = now()
        where id = $9::uuid
        `,
        args.enabled,
        args.accessMode,
        args.askAdmin,
        args.standardDiscountPct,
        args.standardCommissionPct,
        args.premiumDiscountPct,
        args.premiumCommissionPct,
        args.updatedByMembershipId,
        existing.id,
      );
      return;
    }

    await tx.$executeRawUnsafe(
      `
      insert into sales_affiliate_configs (
        id, tenant_id, enabled, access_mode, ask_admin,
        standard_discount_pct, standard_commission_pct,
        premium_discount_pct, premium_commission_pct,
        updated_by_membership_id, created_at, updated_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2, $3, $4, $5, $6, $7, $8, $9::uuid, now(), now()
      )
      `,
      randomUUID(),
      args.enabled,
      args.accessMode,
      args.askAdmin,
      args.standardDiscountPct,
      args.standardCommissionPct,
      args.premiumDiscountPct,
      args.premiumCommissionPct,
      args.updatedByMembershipId,
    );
  },

  async findAffiliateByMembership(tx: TenantTx, membershipId: string): Promise<AffiliateRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateRow[]>(
      `
      select id::text, membership_id::text, tier, status, coupon_code,
             payout_upi, payout_bank_account, payout_ifsc, payout_account_name,
             created_by_membership_id::text, created_at, updated_at
      from sales_affiliates
      where membership_id = $1::uuid
      limit 1
      `,
      membershipId,
    );
    return rows[0] ?? null;
  },

  async findAffiliateByCode(tx: TenantTx, code: string): Promise<AffiliateRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateRow[]>(
      `
      select id::text, membership_id::text, tier, status, coupon_code,
             payout_upi, payout_bank_account, payout_ifsc, payout_account_name,
             created_by_membership_id::text, created_at, updated_at
      from sales_affiliates
      where coupon_code = $1
      limit 1
      `,
      code,
    );
    return rows[0] ?? null;
  },

  async findAffiliateById(tx: TenantTx, id: string): Promise<AffiliateRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateRow[]>(
      `
      select id::text, membership_id::text, tier, status, coupon_code,
             payout_upi, payout_bank_account, payout_ifsc, payout_account_name,
             created_by_membership_id::text, created_at, updated_at
      from sales_affiliates
      where id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async listAffiliates(
    tx: TenantTx,
    args: { q?: string; status?: string; id?: string; limit: number },
  ): Promise<AffiliateListRow[]> {
    const q = args.q?.trim() ? `%${args.q.trim()}%` : null;
    const status = args.status && args.status !== "ALL" ? args.status : null;
    return tx.$queryRawUnsafe<AffiliateListRow[]>(
      `
      select
        a.id::text,
        a.membership_id::text,
        a.tier,
        a.status,
        a.coupon_code,
        a.payout_upi,
        a.payout_bank_account,
        a.payout_ifsc,
        a.payout_account_name,
        a.created_by_membership_id::text,
        a.created_at,
        a.updated_at,
        mp.display_name,
        ap.email,
        coalesce((
          select sum(c.commission_cents)::int
          from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.status = 'UNPAID'
        ), 0) as unpaid_cents,
        coalesce((
          select sum(c.commission_cents)::int
          from sales_affiliate_commissions c
          where c.affiliate_id = a.id
            and c.status = 'PAID'
        ), 0) as paid_cents
      from sales_affiliates a
      left join member_profiles mp
        on mp.membership_id = a.membership_id
       and mp.tenant_id = a.tenant_id
       and mp.deleted_at is null
      left join memberships m
        on m.id = a.membership_id
       and m.tenant_id = a.tenant_id
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where ($1::text is null
         or a.coupon_code ilike $1
         or coalesce(mp.display_name, '') ilike $1
         or coalesce(ap.email, '') ilike $1)
        and ($2::text is null or a.status = $2)
        and ($4::uuid is null or a.id = $4::uuid)
      order by a.created_at desc
      limit $3
      `,
      q,
      status,
      args.limit,
      args.id ?? null,
    );
  },

  async insertAffiliate(
    tx: TenantTx,
    args: {
      membershipId: string;
      tier: string;
      status: string;
      couponCode: string;
      createdByMembershipId: string | null;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_affiliates (
        id, tenant_id, membership_id, tier, status, coupon_code,
        created_by_membership_id, created_at, updated_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3, $4, $5,
        $6::uuid, now(), now()
      )
      `,
      id,
      args.membershipId,
      args.tier,
      args.status,
      args.couponCode,
      args.createdByMembershipId,
    );
    return id;
  },

  async updateAffiliate(
    tx: TenantTx,
    id: string,
    args: {
      tier?: string;
      status?: string;
      couponCode?: string;
      payoutUpi?: string | null;
      payoutBankAccount?: string | null;
      payoutIfsc?: string | null;
      payoutAccountName?: string | null;
    },
  ) {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    let idx = 1;

    if (args.tier !== undefined) {
      sets.push(`tier = $${idx++}`);
      params.push(args.tier);
    }
    if (args.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(args.status);
    }
    if (args.couponCode !== undefined) {
      sets.push(`coupon_code = $${idx++}`);
      params.push(args.couponCode);
    }
    if (args.payoutUpi !== undefined) {
      sets.push(`payout_upi = $${idx++}`);
      params.push(args.payoutUpi);
    }
    if (args.payoutBankAccount !== undefined) {
      sets.push(`payout_bank_account = $${idx++}`);
      params.push(args.payoutBankAccount);
    }
    if (args.payoutIfsc !== undefined) {
      sets.push(`payout_ifsc = $${idx++}`);
      params.push(args.payoutIfsc);
    }
    if (args.payoutAccountName !== undefined) {
      sets.push(`payout_account_name = $${idx++}`);
      params.push(args.payoutAccountName);
    }

    params.push(id);
    await tx.$executeRawUnsafe(
      `update sales_affiliates set ${sets.join(", ")} where id = $${idx}::uuid`,
      ...params,
    );
  },

  async ensureUniqueCouponCode(tx: TenantTx, preferred?: string | null): Promise<string> {
    if (preferred) {
      const normalized = normalizeAffiliateCode(preferred);
      if (!normalized) throw new Error("Invalid coupon code.");
      const existing = await this.findAffiliateByCode(tx, normalized);
      if (existing) throw new Error("Coupon code already in use.");
      return normalized;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateAffiliateCouponCode();
      const existing = await this.findAffiliateByCode(tx, code);
      if (!existing) return code;
    }
    throw new Error("Failed to allocate a unique affiliate coupon code.");
  },

  async listProducts(tx: TenantTx): Promise<AffiliateProductListRow[]> {
    return tx.$queryRawUnsafe<AffiliateProductListRow[]>(
      `
      select
        p.id::text,
        p.course_id::text,
        p.enabled,
        p.standard_discount_pct,
        p.standard_commission_pct,
        p.premium_discount_pct,
        p.premium_commission_pct,
        p.created_at,
        p.updated_at,
        c.title as course_title
      from sales_affiliate_products p
      left join courses c
        on c.id = p.course_id
       and c.tenant_id = p.tenant_id
      order by p.updated_at desc
      `,
    );
  },

  async findProductByCourse(tx: TenantTx, courseId: string): Promise<AffiliateProductRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateProductRow[]>(
      `
      select id::text, course_id::text, enabled,
             standard_discount_pct, standard_commission_pct,
             premium_discount_pct, premium_commission_pct,
             created_at, updated_at
      from sales_affiliate_products
      where course_id = $1::uuid
      limit 1
      `,
      courseId,
    );
    return rows[0] ?? null;
  },

  async upsertProduct(
    tx: TenantTx,
    args: {
      courseId: string;
      enabled: boolean;
      standardDiscountPct: number | null;
      standardCommissionPct: number | null;
      premiumDiscountPct: number | null;
      premiumCommissionPct: number | null;
    },
  ): Promise<string> {
    const existing = await this.findProductByCourse(tx, args.courseId);
    if (existing) {
      await tx.$executeRawUnsafe(
        `
        update sales_affiliate_products
        set enabled = $1,
            standard_discount_pct = $2,
            standard_commission_pct = $3,
            premium_discount_pct = $4,
            premium_commission_pct = $5,
            updated_at = now()
        where id = $6::uuid
        `,
        args.enabled,
        args.standardDiscountPct,
        args.standardCommissionPct,
        args.premiumDiscountPct,
        args.premiumCommissionPct,
        existing.id,
      );
      return existing.id;
    }

    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_affiliate_products (
        id, tenant_id, course_id, enabled,
        standard_discount_pct, standard_commission_pct,
        premium_discount_pct, premium_commission_pct,
        created_at, updated_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3, $4, $5, $6, $7, now(), now()
      )
      `,
      id,
      args.courseId,
      args.enabled,
      args.standardDiscountPct,
      args.standardCommissionPct,
      args.premiumDiscountPct,
      args.premiumCommissionPct,
    );
    return id;
  },

  async insertRequest(
    tx: TenantTx,
    args: { membershipId: string; note?: string | null },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_affiliate_requests (
        id, tenant_id, membership_id, status, note, created_at, updated_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, 'PENDING', $3, now(), now()
      )
      `,
      id,
      args.membershipId,
      args.note ?? null,
    );
    return id;
  },

  async listRequests(
    tx: TenantTx,
    args: { status?: string; limit: number },
  ): Promise<AffiliateRequestListRow[]> {
    const status = args.status && args.status !== "ALL" ? args.status : null;
    return tx.$queryRawUnsafe<AffiliateRequestListRow[]>(
      `
      select
        r.id::text,
        r.membership_id::text,
        r.status,
        r.note,
        r.reviewed_by_membership_id::text,
        r.reviewed_at,
        r.created_at,
        r.updated_at,
        mp.display_name,
        ap.email
      from sales_affiliate_requests r
      left join member_profiles mp
        on mp.membership_id = r.membership_id
       and mp.tenant_id = r.tenant_id
       and mp.deleted_at is null
      left join memberships m
        on m.id = r.membership_id
       and m.tenant_id = r.tenant_id
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where ($1::text is null or r.status = $1)
      order by r.created_at desc
      limit $2
      `,
      status,
      args.limit,
    );
  },

  async findRequestById(tx: TenantTx, id: string): Promise<AffiliateRequestRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateRequestRow[]>(
      `
      select id::text, membership_id::text, status, note,
             reviewed_by_membership_id::text, reviewed_at, created_at, updated_at
      from sales_affiliate_requests
      where id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },

  async findPendingRequest(tx: TenantTx, membershipId: string): Promise<AffiliateRequestRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliateRequestRow[]>(
      `
      select id::text, membership_id::text, status, note,
             reviewed_by_membership_id::text, reviewed_at, created_at, updated_at
      from sales_affiliate_requests
      where membership_id = $1::uuid
        and status = 'PENDING'
      limit 1
      `,
      membershipId,
    );
    return rows[0] ?? null;
  },

  async updateRequestStatus(
    tx: TenantTx,
    id: string,
    args: {
      status: string;
      note?: string | null;
      reviewedByMembershipId: string;
    },
  ) {
    await tx.$executeRawUnsafe(
      `
      update sales_affiliate_requests
      set status = $1,
          note = coalesce($2, note),
          reviewed_by_membership_id = $3::uuid,
          reviewed_at = now(),
          updated_at = now()
      where id = $4::uuid
      `,
      args.status,
      args.note ?? null,
      args.reviewedByMembershipId,
      id,
    );
  },

  async insertCommission(
    tx: TenantTx,
    args: {
      affiliateId: string;
      affiliateMembershipId: string;
      buyerMembershipId: string;
      courseId: string;
      paymentOrderId: string;
      couponCodeSnapshot: string;
      tierSnapshot: string;
      orderAmountCents: number;
      discountCents: number;
      commissionCents: number;
      currency: string;
    },
  ): Promise<boolean> {
    const id = randomUUID();
    const result = await tx.$executeRawUnsafe<number>(
      `
      insert into sales_affiliate_commissions (
        id, tenant_id, affiliate_id, affiliate_membership_id, buyer_membership_id,
        course_id, payment_order_id, coupon_code_snapshot, tier_snapshot,
        order_amount_cents, discount_cents, commission_cents, currency,
        status, created_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3::uuid, $4::uuid,
        $5::uuid, $6::uuid, $7, $8, $9, $10, $11, $12, 'UNPAID', now()
      )
      on conflict (tenant_id, payment_order_id) do nothing
      `,
      id,
      args.affiliateId,
      args.affiliateMembershipId,
      args.buyerMembershipId,
      args.courseId,
      args.paymentOrderId,
      args.couponCodeSnapshot,
      args.tierSnapshot,
      args.orderAmountCents,
      args.discountCents,
      args.commissionCents,
      args.currency,
    );
    return result > 0;
  },

  async getSummary(tx: TenantTx): Promise<{
    active_partners: number;
    total_partners: number;
    pending_requests: number;
    unpaid_cents: number;
    paid_cents: number;
    partners_with_unpaid: number;
    enabled_products: number;
  }> {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        active_partners: number;
        total_partners: number;
        pending_requests: number;
        unpaid_cents: number;
        paid_cents: number;
        partners_with_unpaid: number;
        enabled_products: number;
      }>
    >(
      `
      select
        (select count(*)::int from sales_affiliates where status = 'ACTIVE') as active_partners,
        (select count(*)::int from sales_affiliates) as total_partners,
        (select count(*)::int from sales_affiliate_requests where status = 'PENDING') as pending_requests,
        (select coalesce(sum(commission_cents), 0)::int
           from sales_affiliate_commissions where status = 'UNPAID') as unpaid_cents,
        (select coalesce(sum(amount_cents), 0)::int from sales_affiliate_payouts) as paid_cents,
        (select count(distinct affiliate_id)::int
           from sales_affiliate_commissions where status = 'UNPAID') as partners_with_unpaid,
        (select count(*)::int from sales_affiliate_products where enabled = true) as enabled_products
      `,
    );
    return (
      rows[0] ?? {
        active_partners: 0,
        total_partners: 0,
        pending_requests: 0,
        unpaid_cents: 0,
        paid_cents: 0,
        partners_with_unpaid: 0,
        enabled_products: 0,
      }
    );
  },

  async sumUnpaidCommissions(tx: TenantTx, affiliateId: string): Promise<number> {
    const rows = await tx.$queryRawUnsafe<{ total: bigint }[]>(
      `
      select coalesce(sum(commission_cents), 0)::bigint as total
      from sales_affiliate_commissions
      where affiliate_id = $1::uuid
        and status = 'UNPAID'
      `,
      affiliateId,
    );
    return Number(rows[0]?.total ?? 0);
  },

  async sumPaidCommissions(tx: TenantTx, affiliateId: string): Promise<number> {
    const rows = await tx.$queryRawUnsafe<{ total: bigint }[]>(
      `
      select coalesce(sum(commission_cents), 0)::bigint as total
      from sales_affiliate_commissions
      where affiliate_id = $1::uuid
        and status = 'PAID'
      `,
      affiliateId,
    );
    return Number(rows[0]?.total ?? 0);
  },

  async listCommissions(
    tx: TenantTx,
    args: { affiliateId?: string; status?: string; limit: number },
  ): Promise<AffiliateCommissionRow[]> {
    return tx.$queryRawUnsafe<AffiliateCommissionRow[]>(
      `
      select id::text, affiliate_id::text, affiliate_membership_id::text,
             buyer_membership_id::text, course_id::text, payment_order_id::text,
             coupon_code_snapshot, tier_snapshot, order_amount_cents, discount_cents,
             commission_cents, currency, status, payout_id::text, created_at
      from sales_affiliate_commissions
      where ($1::uuid is null or affiliate_id = $1::uuid)
        and ($2::text is null or status = $2)
      order by created_at desc
      limit $3
      `,
      args.affiliateId ?? null,
      args.status ?? null,
      args.limit,
    );
  },

  async markCommissionsPaid(
    tx: TenantTx,
    args: { affiliateId: string; payoutId: string },
  ): Promise<number> {
    const result = await tx.$executeRawUnsafe<number>(
      `
      update sales_affiliate_commissions
      set status = 'PAID', payout_id = $1::uuid
      where affiliate_id = $2::uuid
        and status = 'UNPAID'
      `,
      args.payoutId,
      args.affiliateId,
    );
    return result;
  },

  async insertPayout(
    tx: TenantTx,
    args: {
      affiliateId: string;
      affiliateMembershipId: string;
      amountCents: number;
      currency: string;
      note?: string | null;
      markedByMembershipId: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_affiliate_payouts (
        id, tenant_id, affiliate_id, affiliate_membership_id,
        amount_cents, currency, status, note, marked_by_membership_id,
        paid_at, created_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3::uuid,
        $4, $5, 'PAID', $6, $7::uuid, now(), now()
      )
      `,
      id,
      args.affiliateId,
      args.affiliateMembershipId,
      args.amountCents,
      args.currency,
      args.note ?? null,
      args.markedByMembershipId,
    );
    return id;
  },

  async listPayouts(
    tx: TenantTx,
    args: { affiliateId?: string; limit: number },
  ): Promise<AffiliatePayoutListRow[]> {
    return tx.$queryRawUnsafe<AffiliatePayoutListRow[]>(
      `
      select
        p.id::text,
        p.affiliate_id::text,
        p.affiliate_membership_id::text,
        p.amount_cents,
        p.currency,
        p.status,
        p.note,
        p.marked_by_membership_id::text,
        p.paid_at,
        p.created_at,
        mp.display_name,
        ap.email
      from sales_affiliate_payouts p
      left join sales_affiliates a
        on a.id = p.affiliate_id
       and a.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = a.membership_id
       and mp.tenant_id = a.tenant_id
       and mp.deleted_at is null
      left join memberships m
        on m.id = a.membership_id
       and m.tenant_id = a.tenant_id
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where ($1::uuid is null or p.affiliate_id = $1::uuid)
      order by p.paid_at desc
      limit $2
      `,
      args.affiliateId ?? null,
      args.limit,
    );
  },

  async findPayoutById(tx: TenantTx, id: string): Promise<AffiliatePayoutListRow | null> {
    const rows = await tx.$queryRawUnsafe<AffiliatePayoutListRow[]>(
      `
      select
        p.id::text,
        p.affiliate_id::text,
        p.affiliate_membership_id::text,
        p.amount_cents,
        p.currency,
        p.status,
        p.note,
        p.marked_by_membership_id::text,
        p.paid_at,
        p.created_at,
        mp.display_name,
        ap.email
      from sales_affiliate_payouts p
      left join sales_affiliates a
        on a.id = p.affiliate_id
       and a.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = a.membership_id
       and mp.tenant_id = a.tenant_id
       and mp.deleted_at is null
      left join memberships m
        on m.id = a.membership_id
       and m.tenant_id = a.tenant_id
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where p.id = $1::uuid
      limit 1
      `,
      id,
    );
    return rows[0] ?? null;
  },
};
