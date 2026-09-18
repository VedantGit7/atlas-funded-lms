import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type WalletConfigRow = {
  id: string;
  enabled: boolean;
  credit_value_cents: number;
  currency: string;
  max_balance_credits: number | null;
  max_credits_per_order: number | null;
  updated_at: Date;
};

export type WalletRow = {
  id: string;
  membership_id: string;
  balance_credits: number;
  earned_credits: number;
  used_credits: number;
  updated_at: Date;
  display_name?: string | null;
  email?: string | null;
};

export type WalletTransactionRow = {
  id: string;
  direction: string;
  reason: string;
  credits: number;
  balance_after: number;
  money_cents: number | null;
  currency: string | null;
  payment_order_id: string | null;
  course_id: string | null;
  note: string | null;
  created_at: Date;
};

export type WalletTxnInput = {
  walletId: string;
  membershipId: string;
  direction: "CREDIT" | "DEBIT";
  reason: string;
  credits: number;
  balanceAfter: number;
  moneyCents: number | null;
  currency: string | null;
  paymentOrderId?: string | null;
  courseId?: string | null;
  note?: string | null;
  createdByMembershipId?: string | null;
};

export const salesWalletRepository = {
  async getConfig(tx: TenantTx): Promise<WalletConfigRow | null> {
    const rows = await tx.$queryRawUnsafe<WalletConfigRow[]>(
      `
      select id::text, enabled, credit_value_cents, currency,
             max_balance_credits, max_credits_per_order, updated_at
      from sales_wallet_configs
      limit 1
      `,
    );
    return rows[0] ?? null;
  },

  async upsertConfig(
    tx: TenantTx,
    args: {
      enabled: boolean;
      creditValueCents: number;
      currency: string;
      maxBalanceCredits: number | null;
      maxCreditsPerOrder: number | null;
      updatedByMembershipId: string;
    },
  ) {
    const existing = await this.getConfig(tx);
    if (existing) {
      await tx.$executeRawUnsafe(
        `
        update sales_wallet_configs
        set enabled = $1,
            credit_value_cents = $2,
            currency = $3,
            max_balance_credits = $4,
            max_credits_per_order = $5,
            updated_by_membership_id = $6::uuid,
            updated_at = now()
        where id = $7::uuid
        `,
        args.enabled,
        args.creditValueCents,
        args.currency,
        args.maxBalanceCredits,
        args.maxCreditsPerOrder,
        args.updatedByMembershipId,
        existing.id,
      );
      return existing.id;
    }
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_wallet_configs (
        id, tenant_id, enabled, credit_value_cents, currency,
        max_balance_credits, max_credits_per_order, updated_by_membership_id
      ) values (
        $1::uuid, app.current_tenant_id(), $2, $3, $4, $5, $6, $7::uuid
      )
      `,
      id,
      args.enabled,
      args.creditValueCents,
      args.currency,
      args.maxBalanceCredits,
      args.maxCreditsPerOrder,
      args.updatedByMembershipId,
    );
    return id;
  },

  async findWalletByMembership(tx: TenantTx, membershipId: string): Promise<WalletRow | null> {
    const rows = await tx.$queryRawUnsafe<WalletRow[]>(
      `
      select id::text, membership_id::text, balance_credits, earned_credits, used_credits, updated_at
      from sales_wallets
      where membership_id = $1::uuid
      limit 1
      `,
      membershipId,
    );
    return rows[0] ?? null;
  },

  async ensureWallet(tx: TenantTx, membershipId: string): Promise<WalletRow> {
    const existing = await this.findWalletByMembership(tx, membershipId);
    if (existing) return existing;
    const id = randomUUID();
    await tx.$executeRaw`
      insert into sales_wallets (id, tenant_id, membership_id)
      values (${id}::uuid, app.current_tenant_id(), ${membershipId}::uuid)
      on conflict (tenant_id, membership_id) do nothing
    `;
    const created = await this.findWalletByMembership(tx, membershipId);
    if (!created) throw new Error("WALLET_ENSURE_FAILED");
    return created;
  },

  async findWalletAccountByMembership(
    tx: TenantTx,
    membershipId: string,
  ): Promise<WalletRow | null> {
    const rows = await tx.$queryRawUnsafe<WalletRow[]>(
      `
      select
        w.id::text,
        w.membership_id::text,
        w.balance_credits,
        w.earned_credits,
        w.used_credits,
        w.updated_at,
        p.display_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from sales_wallets w
      left join memberships m on m.id = w.membership_id
      left join member_profiles p on p.membership_id = w.membership_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where w.membership_id = $1::uuid
      limit 1
      `,
      membershipId,
    );
    return rows[0] ?? null;
  },

  async listWallets(tx: TenantTx, args: { q?: string; limit: number }): Promise<WalletRow[]> {
    const q = args.q?.trim() ?? "";
    return tx.$queryRawUnsafe<WalletRow[]>(
      `
      select
        w.id::text,
        w.membership_id::text,
        w.balance_credits,
        w.earned_credits,
        w.used_credits,
        w.updated_at,
        p.display_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from sales_wallets w
      left join memberships m on m.id = w.membership_id
      left join member_profiles p on p.membership_id = w.membership_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where (
        $1 = ''
        or coalesce(p.display_name, '') ilike '%' || $1 || '%'
        or coalesce(ap.email, '') ilike '%' || $1 || '%'
        or coalesce(m.invited_email_normalized, '') ilike '%' || $1 || '%'
      )
      order by w.updated_at desc
      limit $2
      `,
      q,
      args.limit,
    );
  },

  /**
   * Absolute balance write. Only safe when the caller has already established
   * the exact target value under a lock — prefer spendCredits/creditCredits,
   * which compute the new balance inside the UPDATE itself.
   */
  async updateBalances(
    tx: TenantTx,
    args: {
      walletId: string;
      balanceCredits: number;
      earnedCredits: number;
      usedCredits: number;
    },
  ) {
    await tx.$executeRaw`
      update sales_wallets
      set balance_credits = ${args.balanceCredits},
          earned_credits = ${args.earnedCredits},
          used_credits = ${args.usedCredits},
          updated_at = now()
      where id = ${args.walletId}::uuid
    `;
  },

  /**
   * Atomically spend credits.
   *
   * The `balance_credits >= credits` predicate IS the guard: it is evaluated by
   * Postgres against the current row, not against a value the caller read
   * earlier. Returns null when the balance is insufficient (zero rows updated).
   *
   * Replaces a read-compute-absolute-write sequence that was demonstrated
   * double-spending: five concurrent spends of 100 credits all succeeded against
   * a 100-credit wallet because each read the same stale balance under READ
   * COMMITTED. The post-balance is taken from RETURNING so the append-only
   * ledger records the true value.
   */
  async spendCredits(
    tx: TenantTx,
    args: { walletId: string; credits: number },
  ): Promise<{ balanceAfter: number } | null> {
    const rows = await tx.$queryRaw<Array<{ balance_credits: number }>>`
      update sales_wallets
      set balance_credits = balance_credits - ${args.credits},
          used_credits = used_credits + ${args.credits},
          updated_at = now()
      where id = ${args.walletId}::uuid
        and balance_credits >= ${args.credits}
      returning balance_credits
    `;

    const row = rows[0];
    return row ? { balanceAfter: row.balance_credits } : null;
  },

  /**
   * Lock a wallet row for the remainder of the transaction.
   *
   * Crediting needs the current balance to apply max_balance_credits, so it
   * cannot be expressed as pure arithmetic the way spending can. Taking the row
   * lock first makes the subsequent read-compute-write safe: concurrent
   * transactions serialise on this lock instead of racing on a stale read.
   */
  async lockWalletForUpdate(
    tx: TenantTx,
    walletId: string,
  ): Promise<{ balanceCredits: number; earnedCredits: number; usedCredits: number } | null> {
    // Returns every column a subsequent absolute write touches. Mixing
    // post-lock values with a pre-lock read would let a concurrent spend that
    // committed in between have its used_credits increment silently clobbered.
    const rows = await tx.$queryRaw<
      Array<{ balance_credits: number; earned_credits: number; used_credits: number }>
    >`
      select balance_credits, earned_credits, used_credits
      from sales_wallets
      where id = ${walletId}::uuid
      for update
    `;

    const row = rows[0];
    return row
      ? {
          balanceCredits: row.balance_credits,
          earnedCredits: row.earned_credits,
          usedCredits: row.used_credits,
        }
      : null;
  },

  async insertTransaction(tx: TenantTx, args: WalletTxnInput): Promise<string> {
    const id = randomUUID();
    await tx.$executeRawUnsafe(
      `
      insert into sales_wallet_transactions (
        id, tenant_id, wallet_id, membership_id, direction, reason, credits,
        balance_after, money_cents, currency, payment_order_id, course_id, note,
        created_by_membership_id
      ) values (
        $1::uuid, app.current_tenant_id(), $2::uuid, $3::uuid, $4, $5, $6,
        $7, $8, $9, $10::uuid, $11::uuid, $12, $13::uuid
      )
      `,
      id,
      args.walletId,
      args.membershipId,
      args.direction,
      args.reason,
      args.credits,
      args.balanceAfter,
      args.moneyCents,
      args.currency,
      args.paymentOrderId ?? null,
      args.courseId ?? null,
      args.note ?? null,
      args.createdByMembershipId ?? null,
    );
    return id;
  },

  async listTransactions(
    tx: TenantTx,
    args: { membershipId: string; limit: number },
  ): Promise<WalletTransactionRow[]> {
    return tx.$queryRawUnsafe<WalletTransactionRow[]>(
      `
      select
        id::text, direction, reason, credits, balance_after, money_cents, currency,
        payment_order_id::text, course_id::text, note, created_at
      from sales_wallet_transactions
      where membership_id = $1::uuid
      order by created_at desc
      limit $2
      `,
      args.membershipId,
      args.limit,
    );
  },
};
