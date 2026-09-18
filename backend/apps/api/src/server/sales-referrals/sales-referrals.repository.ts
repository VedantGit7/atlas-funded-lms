import { randomInt, randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type ReferralConfigRow = {
  id: string;
  enabled: boolean;
  referrer_signup_credits: number;
  referee_signup_credits: number;
  referrer_purchase_credits: number;
  max_referrals: number | null;
  updated_at: Date;
};

export type ReferralCodeRow = {
  id: string;
  membership_id: string;
  code: string;
  created_at: Date;
};

export type ReferralAttributionRow = {
  id: string;
  referral_code_id: string;
  referrer_membership_id: string;
  referee_membership_id: string;
  code_snapshot: string;
  signup_credited_at: Date | null;
  created_at: Date;
};

export type ReferralStatsRow = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
  code: string;
  successful_referrals: number;
  signup_credits_earned: number;
  purchase_credits_earned: number;
  created_at: Date;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

export function generateReferralCodeValue(): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  }
  return out;
}

export const salesReferralsRepository = {
  async getConfig(tx: TenantTx): Promise<ReferralConfigRow | null> {
    const rows = await tx.$queryRawUnsafe<ReferralConfigRow[]>(
      `
      select id::text, enabled, referrer_signup_credits, referee_signup_credits,
             referrer_purchase_credits, max_referrals, updated_at
      from sales_referral_configs
      limit 1
      `,
    );
    return rows[0] ?? null;
  },

  async upsertConfig(
    tx: TenantTx,
    args: {
      enabled: boolean;
      referrerSignupCredits: number;
      refereeSignupCredits: number;
      referrerPurchaseCredits: number;
      maxReferrals: number | null;
      updatedByMembershipId: string;
    },
  ) {
    const existing = await this.getConfig(tx);
    if (existing) {
      await tx.$executeRawUnsafe(
        `
        update sales_referral_configs
        set enabled = $1,
            referrer_signup_credits = $2,
            referee_signup_credits = $3,
            referrer_purchase_credits = $4,
            max_referrals = $5,
            updated_by_membership_id = $6::uuid,
            updated_at = now()
        where id = $7::uuid
        `,
        args.enabled,
        args.referrerSignupCredits,
        args.refereeSignupCredits,
        args.referrerPurchaseCredits,
        args.maxReferrals,
        args.updatedByMembershipId,
        existing.id,
      );
      return;
    }

    await tx.$executeRawUnsafe(
      `
      insert into sales_referral_configs (
        id, tenant_id, enabled, referrer_signup_credits, referee_signup_credits,
        referrer_purchase_credits, max_referrals, updated_by_membership_id, created_at, updated_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2, $3, $4, $5, $6, $7::uuid, now(), now()
      )
      `,
      randomUUID(),
      args.enabled,
      args.referrerSignupCredits,
      args.refereeSignupCredits,
      args.referrerPurchaseCredits,
      args.maxReferrals,
      args.updatedByMembershipId,
    );
  },

  async findCodeByMembership(tx: TenantTx, membershipId: string): Promise<ReferralCodeRow | null> {
    const rows = await tx.$queryRawUnsafe<ReferralCodeRow[]>(
      `
      select id::text, membership_id::text, code, created_at
      from sales_referral_codes
      where membership_id = $1::uuid
      limit 1
      `,
      membershipId,
    );
    return rows[0] ?? null;
  },

  async findCodeByValue(tx: TenantTx, code: string): Promise<ReferralCodeRow | null> {
    const rows = await tx.$queryRawUnsafe<ReferralCodeRow[]>(
      `
      select id::text, membership_id::text, code, created_at
      from sales_referral_codes
      where code = $1
      limit 1
      `,
      code,
    );
    return rows[0] ?? null;
  },

  async ensureCodeForMembership(tx: TenantTx, membershipId: string): Promise<ReferralCodeRow> {
    const existing = await this.findCodeByMembership(tx, membershipId);
    if (existing) return existing;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateReferralCodeValue();
      try {
        const id = randomUUID();
        await tx.$executeRawUnsafe(
          `
          insert into sales_referral_codes (
            id, tenant_id, membership_id, code, created_at, updated_at
          ) values (
            $1::uuid, app.current_tenant_id(), $2::uuid, $3, now(), now()
          )
          `,
          id,
          membershipId,
          code,
        );
        return {
          id,
          membership_id: membershipId,
          code,
          created_at: new Date(),
        };
      } catch {
        // Unique collision — retry with a new code.
      }
    }
    throw new Error("Failed to allocate a unique referral code.");
  },

  async countSuccessfulReferrals(tx: TenantTx, referrerMembershipId: string): Promise<number> {
    const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(
      `
      select count(*)::bigint as count
      from sales_referral_attributions
      where referrer_membership_id = $1::uuid
        and signup_credited_at is not null
      `,
      referrerMembershipId,
    );
    return Number(rows[0]?.count ?? 0);
  },

  async findAttributionByReferee(
    tx: TenantTx,
    refereeMembershipId: string,
  ): Promise<ReferralAttributionRow | null> {
    const rows = await tx.$queryRawUnsafe<ReferralAttributionRow[]>(
      `
      select id::text, referral_code_id::text, referrer_membership_id::text,
             referee_membership_id::text, code_snapshot, signup_credited_at, created_at
      from sales_referral_attributions
      where referee_membership_id = $1::uuid
      limit 1
      `,
      refereeMembershipId,
    );
    return rows[0] ?? null;
  },

  async insertAttribution(
    tx: TenantTx,
    args: {
      referralCodeId: string;
      referrerMembershipId: string;
      refereeMembershipId: string;
      codeSnapshot: string;
      signupCreditedAt: Date | null;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_referral_attributions (
        id, tenant_id, referral_code_id, referrer_membership_id, referee_membership_id,
        code_snapshot, signup_credited_at, created_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3::uuid, $4::uuid,
        $5, $6, now()
      )
      `,
      id,
      args.referralCodeId,
      args.referrerMembershipId,
      args.refereeMembershipId,
      args.codeSnapshot,
      args.signupCreditedAt,
    );
    return id;
  },

  async markSignupCredited(tx: TenantTx, attributionId: string) {
    await tx.$executeRawUnsafe(
      `
      update sales_referral_attributions
      set signup_credited_at = now()
      where id = $1::uuid
        and signup_credited_at is null
      `,
      attributionId,
    );
  },

  async insertPurchaseCredit(
    tx: TenantTx,
    args: {
      attributionId: string;
      paymentOrderId: string;
      referrerMembershipId: string;
      refereeMembershipId: string;
      creditsApplied: number;
    },
  ) {
    await tx.$executeRawUnsafe(
      `
      insert into sales_referral_purchase_credits (
        id, tenant_id, attribution_id, payment_order_id,
        referrer_membership_id, referee_membership_id, credits_applied, created_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3::uuid,
        $4::uuid, $5::uuid, $6, now()
      )
      on conflict (tenant_id, payment_order_id) do nothing
      `,
      randomUUID(),
      args.attributionId,
      args.paymentOrderId,
      args.referrerMembershipId,
      args.refereeMembershipId,
      args.creditsApplied,
    );
  },

  async hasPurchaseCreditForOrder(tx: TenantTx, paymentOrderId: string): Promise<boolean> {
    const rows = await tx.$queryRawUnsafe<{ ok: boolean }[]>(
      `
      select true as ok
      from sales_referral_purchase_credits
      where payment_order_id = $1::uuid
      limit 1
      `,
      paymentOrderId,
    );
    return Boolean(rows[0]?.ok);
  },

  async upsertPending(
    tx: TenantTx,
    args: { emailNormalized: string; code: string; expiresAt: Date },
  ) {
    const existing = await tx.$queryRawUnsafe<{ id: string }[]>(
      `
      select id::text from sales_referral_pending
      where email_normalized = $1
      limit 1
      `,
      args.emailNormalized,
    );
    if (existing[0]) {
      await tx.$executeRawUnsafe(
        `
        update sales_referral_pending
        set code = $1, expires_at = $2, created_at = now()
        where id = $3::uuid
        `,
        args.code,
        args.expiresAt,
        existing[0].id,
      );
      return;
    }
    await tx.$executeRawUnsafe(
      `
      insert into sales_referral_pending (
        id, tenant_id, email_normalized, code, expires_at, created_at
      ) values (
        $1::uuid, app.current_tenant_id(), $2, $3, $4, now()
      )
      `,
      randomUUID(),
      args.emailNormalized,
      args.code,
      args.expiresAt,
    );
  },

  async takePending(tx: TenantTx, emailNormalized: string): Promise<string | null> {
    const rows = await tx.$queryRawUnsafe<{ id: string; code: string }[]>(
      `
      select id::text, code
      from sales_referral_pending
      where email_normalized = $1
        and expires_at > now()
      limit 1
      `,
      emailNormalized,
    );
    const row = rows[0];
    if (!row) return null;
    await tx.$executeRawUnsafe(`delete from sales_referral_pending where id = $1::uuid`, row.id);
    return row.code;
  },

  async sumRewardsForReferrer(tx: TenantTx, referrerMembershipId: string): Promise<number> {
    const rows = await tx.$queryRawUnsafe<{ total: bigint }[]>(
      `
      select coalesce(sum(credits), 0)::bigint as total
      from sales_wallet_transactions
      where membership_id = $1::uuid
        and direction = 'CREDIT'
        and reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
      `,
      referrerMembershipId,
    );
    return Number(rows[0]?.total ?? 0);
  },

  async listStats(
    tx: TenantTx,
    args: {
      q?: string;
      limit: number;
      sort?: "successfulReferrals" | "creditsEarned" | "createdAt";
    },
  ): Promise<ReferralStatsRow[]> {
    const q = args.q?.trim() ? `%${args.q.trim()}%` : null;
    const orderBy =
      args.sort === "createdAt"
        ? "ranked.created_at desc"
        : args.sort === "creditsEarned"
          ? "(ranked.signup_credits_earned + ranked.purchase_credits_earned) desc, ranked.successful_referrals desc"
          : "ranked.successful_referrals desc, (ranked.signup_credits_earned + ranked.purchase_credits_earned) desc";
    return tx.$queryRawUnsafe<ReferralStatsRow[]>(
      `
      select *
      from (
        select
          c.membership_id::text,
          mp.display_name,
          ap.email,
          c.code,
          (
            select count(*)::int
            from sales_referral_attributions a
            where a.referrer_membership_id = c.membership_id
              and a.signup_credited_at is not null
          ) as successful_referrals,
          (
            select coalesce(sum(t.credits), 0)::int
            from sales_wallet_transactions t
            where t.membership_id = c.membership_id
              and t.direction = 'CREDIT'
              and t.reason = 'REFERRAL_SIGNUP'
          ) as signup_credits_earned,
          (
            select coalesce(sum(t.credits), 0)::int
            from sales_wallet_transactions t
            where t.membership_id = c.membership_id
              and t.direction = 'CREDIT'
              and t.reason = 'REFERRAL_PURCHASE'
          ) as purchase_credits_earned,
          c.created_at
        from sales_referral_codes c
        left join member_profiles mp
          on mp.membership_id = c.membership_id
         and mp.tenant_id = c.tenant_id
         and mp.deleted_at is null
        left join memberships m
          on m.id = c.membership_id
         and m.tenant_id = c.tenant_id
        left join auth_principals ap
          on ap.id = m.auth_principal_id
        where ($1::text is null
           or c.code ilike $1
           or coalesce(mp.display_name, '') ilike $1
           or coalesce(ap.email, '') ilike $1)
      ) ranked
      order by ${orderBy}
      limit $2
      `,
      q,
      args.limit,
    );
  },
};
