import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { CurrencyEarnRules, RewardPayload } from "./rewards.schemas";

export type CurrencyRow = {
  key: string;
  name: string;
  symbol: string | null;
  earn_rules_json: unknown;
};

export type RewardItemRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  cost_currency_key: string;
  cost_amount: number;
  reward_type: string;
  reward_payload_json: unknown;
  stock: number | null;
  status: string;
};

export type RedemptionRow = {
  id: string;
  reward_item_id: string;
  membership_id: string;
  cost_amount: number;
  status: string;
  redeemed_at: Date;
};

export const rewardsRepository = {
  async listCurrencies(tx: TenantTx) {
    const rows = await tx.$queryRaw<CurrencyRow[]>`
      select key, name, symbol, earn_rules_json
      from gamification_currencies
      order by created_at asc
    `;
    return rows;
  },

  async upsertCurrency(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      symbol: string | null;
      earnRules: CurrencyEarnRules | null;
    },
  ) {
    await tx.$executeRaw`
      insert into gamification_currencies (
        id, tenant_id, key, name, symbol, earn_rules_json, created_at, updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${args.symbol},
        ${args.earnRules ? JSON.stringify(args.earnRules) : null}::jsonb,
        now(),
        now()
      )
      on conflict (tenant_id, key)
      do update set
        name = excluded.name,
        symbol = excluded.symbol,
        earn_rules_json = excluded.earn_rules_json,
        updated_at = now()
    `;
  },

  async listRewardItems(tx: TenantTx, args?: { activeOnly?: boolean }) {
    if (args?.activeOnly) {
      const rows = await tx.$queryRaw<RewardItemRow[]>`
        select
          id::text, key, name, description, cost_currency_key, cost_amount,
          reward_type, reward_payload_json, stock, status::text
        from reward_items
        where status = 'ACTIVE'
        order by created_at asc
      `;
      return rows;
    }

    const rows = await tx.$queryRaw<RewardItemRow[]>`
      select
        id::text, key, name, description, cost_currency_key, cost_amount,
        reward_type, reward_payload_json, stock, status::text
      from reward_items
      order by created_at asc
    `;
    return rows;
  },

  async findRewardItemById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<RewardItemRow[]>`
      select
        id::text, key, name, description, cost_currency_key, cost_amount,
        reward_type, reward_payload_json, stock, status::text
      from reward_items
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findRewardItemByKey(tx: TenantTx, key: string) {
    const rows = await tx.$queryRaw<RewardItemRow[]>`
      select
        id::text, key, name, description, cost_currency_key, cost_amount,
        reward_type, reward_payload_json, stock, status::text
      from reward_items
      where key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertRewardItem(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      description: string | null;
      costCurrencyKey: string;
      costAmount: number;
      rewardType: string;
      rewardPayload: RewardPayload;
      stock: number | null;
      status: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into reward_items (
        id, tenant_id, key, name, description, cost_currency_key, cost_amount,
        reward_type, reward_payload_json, stock, status, created_at, updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${args.description},
        ${args.costCurrencyKey},
        ${args.costAmount},
        ${args.rewardType},
        ${JSON.stringify(args.rewardPayload)}::jsonb,
        ${args.stock},
        ${args.status}::"EntityStatus",
        now(),
        now()
      )
    `;
    return rewardsRepository.findRewardItemById(tx, id);
  },

  async updateRewardItem(
    tx: TenantTx,
    args: {
      id: string;
      name?: string;
      description?: string | null;
      costAmount?: number;
      rewardPayload?: RewardPayload;
      stock?: number | null;
      status?: string;
    },
  ) {
    const current = await rewardsRepository.findRewardItemById(tx, args.id);
    if (!current) return null;

    await tx.$executeRaw`
      update reward_items
      set
        name = ${args.name ?? current.name},
        description = ${args.description !== undefined ? args.description : current.description},
        cost_amount = ${args.costAmount ?? current.cost_amount},
        reward_payload_json = ${JSON.stringify(
          args.rewardPayload ?? current.reward_payload_json,
        )}::jsonb,
        stock = ${args.stock !== undefined ? args.stock : current.stock},
        status = ${args.status ?? current.status}::"EntityStatus",
        updated_at = now()
      where id = ${args.id}::uuid
    `;

    return rewardsRepository.findRewardItemById(tx, args.id);
  },

  /** Atomically decrement stock; returns false when the item is sold out. */
  async tryDecrementStock(tx: TenantTx, itemId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      update reward_items
      set stock = stock - 1, updated_at = now()
      where id = ${itemId}::uuid
        and stock is not null
        and stock > 0
      returning id::text
    `;
    return rows.length > 0;
  },

  async getBalance(tx: TenantTx, args: { membershipId: string; currencyKey: string }) {
    const rows = await tx.$queryRaw<Array<{ balance: number }>>`
      select balance
      from member_balances
      where membership_id = ${args.membershipId}::uuid
        and currency_key = ${args.currencyKey}
      limit 1
    `;
    return rows[0]?.balance ?? 0;
  },

  async listBalances(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ currency_key: string; balance: number }>>`
      select currency_key, balance
      from member_balances
      where membership_id = ${membershipId}::uuid
    `;
    return rows;
  },

  async creditBalance(
    tx: TenantTx,
    args: { tenantId: string; membershipId: string; currencyKey: string; amount: number },
  ) {
    const rows = await tx.$queryRaw<Array<{ balance: number }>>`
      insert into member_balances (
        id, tenant_id, membership_id, currency_key, balance, updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.currencyKey},
        ${args.amount},
        now()
      )
      on conflict (tenant_id, membership_id, currency_key)
      do update set
        balance = member_balances.balance + excluded.balance,
        updated_at = now()
      returning balance
    `;
    return rows[0]?.balance ?? args.amount;
  },

  /** Atomically debit; returns the new balance or null when funds are insufficient. */
  async tryDebitBalance(
    tx: TenantTx,
    args: { membershipId: string; currencyKey: string; amount: number },
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<Array<{ balance: number }>>`
      update member_balances
      set balance = balance - ${args.amount}, updated_at = now()
      where membership_id = ${args.membershipId}::uuid
        and currency_key = ${args.currencyKey}
        and balance >= ${args.amount}
      returning balance
    `;
    return rows[0]?.balance ?? null;
  },

  async insertRedemption(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      rewardItemId: string;
      costAmount: number;
      status: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into reward_redemptions (
        id, tenant_id, membership_id, reward_item_id, cost_amount, status, redeemed_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.rewardItemId}::uuid,
        ${args.costAmount},
        ${args.status},
        now()
      )
    `;
    return id;
  },

  async findRedemptionById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<RedemptionRow[]>`
      select
        id::text, reward_item_id::text, membership_id::text,
        cost_amount, status, redeemed_at
      from reward_redemptions
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async updateRedemptionStatus(tx: TenantTx, args: { id: string; status: string }) {
    await tx.$executeRaw`
      update reward_redemptions
      set status = ${args.status}
      where id = ${args.id}::uuid
    `;
  },

  async listRedemptionsForMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        reward_name: string;
        reward_type: string;
        cost_amount: number;
        status: string;
        redeemed_at: Date;
      }>
    >`
      select
        rr.id::text,
        ri.name as reward_name,
        ri.reward_type,
        rr.cost_amount,
        rr.status,
        rr.redeemed_at
      from reward_redemptions rr
      inner join reward_items ri on ri.id = rr.reward_item_id
      where rr.membership_id = ${membershipId}::uuid
      order by rr.redeemed_at desc, rr.id desc
      limit 50
    `;
    return rows;
  },

  async listRedemptionLog(
    tx: TenantTx,
    args: {
      limit: number;
      status?: string;
      cursor?: { redeemedAt: string; id: string };
    },
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        reward_item_id: string;
        reward_name: string;
        reward_type: string;
        membership_id: string;
        member_label: string | null;
        cost_amount: number;
        status: string;
        redeemed_at: Date;
      }>
    >`
      select
        rr.id::text,
        rr.reward_item_id::text,
        ri.name as reward_name,
        ri.reward_type,
        rr.membership_id::text,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as member_label,
        rr.cost_amount,
        rr.status,
        rr.redeemed_at
      from reward_redemptions rr
      inner join reward_items ri on ri.id = rr.reward_item_id
      inner join memberships m on m.id = rr.membership_id
      left join member_profiles mp
        on mp.tenant_id = m.tenant_id
       and mp.membership_id = m.id
       and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where (${args.status ?? null}::text is null or rr.status = ${args.status ?? null})
        and (
          ${args.cursor?.redeemedAt ?? null}::timestamptz is null
          -- Millisecond precision: cursor values round-trip through JS Dates.
          or (date_trunc('milliseconds', rr.redeemed_at), rr.id) < (
            ${args.cursor?.redeemedAt ?? null}::timestamptz,
            ${args.cursor?.id ?? null}::uuid
          )
        )
      order by rr.redeemed_at desc, rr.id desc
      limit ${args.limit + 1}
    `;
    return rows;
  },

  /** CONTENT_UNLOCK fulfillment: grant a course enrollment if missing. */
  async grantEnrollment(
    tx: TenantTx,
    args: { tenantId: string; membershipId: string; courseId: string },
  ) {
    await tx.$executeRaw`
      insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.courseId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        now()
      )
      on conflict (tenant_id, course_id, membership_id) do nothing
    `;
  },
};
