import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  currencyNotFound,
  duplicateRewardKey,
  insufficientBalance,
  invalidTargetMembership,
  redemptionNotFound,
  rewardItemNotFound,
  rewardOutOfStock,
} from "./gamification.errors";
import { gamificationRepository } from "./gamification.repository";
import { rewardsRepository, type CurrencyRow, type RewardItemRow } from "./rewards.repository";
import type {
  CurrencyEarnRules,
  postRewardsBodySchema,
  redemptionLogQuerySchema,
  redeemBodySchema,
  RewardPayload,
  RewardType,
  updateRewardItemBodySchema,
} from "./rewards.schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function toCurrencyDto(row: CurrencyRow) {
  return {
    key: row.key,
    name: row.name,
    symbol: row.symbol,
    earnRules: (row.earn_rules_json as CurrencyEarnRules | null) ?? null,
  };
}

function toRewardItemDto(row: RewardItemRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    costCurrencyKey: row.cost_currency_key,
    costAmount: row.cost_amount,
    rewardType: row.reward_type as RewardType,
    rewardPayload: (row.reward_payload_json as RewardPayload | null) ?? {},
    stock: row.stock,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
  };
}

function writeRewardsAudit(
  tx: TenantTx,
  ctx: ServiceCtx,
  entry: {
    action: string;
    targetType: string;
    /** Audit targets require UUIDs; pass null for key-addressed records. */
    targetId: string | null;
    before: unknown;
    after: unknown;
    reason?: string | null;
  },
) {
  return auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: entry.action,
      target: { type: entry.targetType, id: entry.targetId },
      before: entry.before,
      after: entry.after,
      reason: entry.reason ?? null,
      metadata: {},
    },
  );
}

export async function getRewardsAdmin(tx: TenantTx) {
  const [currencies, items] = await Promise.all([
    rewardsRepository.listCurrencies(tx),
    rewardsRepository.listRewardItems(tx),
  ]);

  return {
    data: {
      currencies: currencies.map(toCurrencyDto),
      items: items.map(toRewardItemDto),
    },
  };
}

export async function mutateRewards(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof postRewardsBodySchema>,
) {
  if (input.operation === "upsert_currency") {
    await rewardsRepository.upsertCurrency(tx, {
      tenantId: ctx.tenantId,
      key: input.currency.key,
      name: input.currency.name,
      symbol: input.currency.symbol ?? null,
      earnRules: input.currency.earnRules ?? null,
    });

    const currencies = await rewardsRepository.listCurrencies(tx);
    await writeRewardsAudit(tx, ctx, {
      action: "rewards.currency_upserted",
      targetType: "gamification_currency",
      targetId: null,
      before: null,
      after: input.currency,
    });

    return { data: { currencies: currencies.map(toCurrencyDto) } };
  }

  if (input.operation === "create_item") {
    const currencies = await rewardsRepository.listCurrencies(tx);
    if (!currencies.some((currency) => currency.key === input.item.costCurrencyKey)) {
      throw currencyNotFound();
    }

    const existing = await rewardsRepository.findRewardItemByKey(tx, input.item.key);
    if (existing) {
      throw duplicateRewardKey();
    }

    const created = await rewardsRepository.insertRewardItem(tx, {
      tenantId: ctx.tenantId,
      key: input.item.key,
      name: input.item.name,
      description: input.item.description ?? null,
      costCurrencyKey: input.item.costCurrencyKey,
      costAmount: input.item.costAmount,
      rewardType: input.item.rewardType,
      rewardPayload: input.item.rewardPayload,
      stock: input.item.stock ?? null,
      status: input.item.status,
    });

    if (!created) {
      throw rewardItemNotFound();
    }

    await writeRewardsAudit(tx, ctx, {
      action: "rewards.item_created",
      targetType: "reward_item",
      targetId: created.id,
      before: null,
      after: toRewardItemDto(created),
    });

    return { data: { item: toRewardItemDto(created) } };
  }

  if (input.operation === "grant_balance" || input.operation === "revoke_balance") {
    const active = await gamificationRepository.membershipIsActive(tx, input.membershipId);
    if (!active) {
      throw invalidTargetMembership();
    }

    const currencies = await rewardsRepository.listCurrencies(tx);
    if (!currencies.some((currency) => currency.key === input.currencyKey)) {
      throw currencyNotFound();
    }

    let balance: number;
    if (input.operation === "grant_balance") {
      balance = await rewardsRepository.creditBalance(tx, {
        tenantId: ctx.tenantId,
        membershipId: input.membershipId,
        currencyKey: input.currencyKey,
        amount: input.amount,
      });
    } else {
      const debited = await rewardsRepository.tryDebitBalance(tx, {
        membershipId: input.membershipId,
        currencyKey: input.currencyKey,
        amount: input.amount,
      });
      if (debited == null) {
        throw insufficientBalance();
      }
      balance = debited;
    }

    await writeRewardsAudit(tx, ctx, {
      action:
        input.operation === "grant_balance" ? "rewards.balance_granted" : "rewards.balance_revoked",
      targetType: "member_balance",
      targetId: input.membershipId,
      before: null,
      after: {
        membershipId: input.membershipId,
        currencyKey: input.currencyKey,
        amount: input.amount,
        balance,
      },
      reason: input.reason,
    });

    return {
      data: {
        balance: {
          membershipId: input.membershipId,
          currencyKey: input.currencyKey,
          balance,
        },
      },
    };
  }

  // fulfill_redemption
  const redemption = await rewardsRepository.findRedemptionById(tx, input.redemptionId);
  if (!redemption) {
    throw redemptionNotFound();
  }

  await rewardsRepository.updateRedemptionStatus(tx, {
    id: input.redemptionId,
    status: "fulfilled",
  });

  await writeRewardsAudit(tx, ctx, {
    action: "rewards.redemption_fulfilled",
    targetType: "reward_redemption",
    targetId: input.redemptionId,
    before: { status: redemption.status },
    after: { status: "fulfilled" },
  });

  return { data: { redemption: { id: input.redemptionId, status: "fulfilled" } } };
}

export async function updateRewardItem(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateRewardItemBodySchema>,
) {
  const before = await rewardsRepository.findRewardItemById(tx, input.id);
  if (!before) {
    throw rewardItemNotFound();
  }

  const updated = await rewardsRepository.updateRewardItem(tx, {
    id: input.id,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.costAmount != null ? { costAmount: input.costAmount } : {}),
    ...(input.rewardPayload != null ? { rewardPayload: input.rewardPayload } : {}),
    ...(input.stock !== undefined ? { stock: input.stock } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  });

  if (!updated) {
    throw rewardItemNotFound();
  }

  await writeRewardsAudit(tx, ctx, {
    action: "rewards.item_updated",
    targetType: "reward_item",
    targetId: input.id,
    before: toRewardItemDto(before),
    after: toRewardItemDto(updated),
  });

  return { data: { item: toRewardItemDto(updated) } };
}

function encodeRedemptionCursor(row: { redeemed_at: Date; id: string }): string {
  return `${row.redeemed_at.toISOString()}|${row.id}`;
}

function decodeRedemptionCursor(cursor: string): { redeemedAt: string; id: string } | null {
  const [redeemedAt, id] = cursor.split("|");
  if (!redeemedAt || !id) return null;
  return { redeemedAt, id };
}

export async function listRedemptionLog(
  tx: TenantTx,
  input: z.output<typeof redemptionLogQuerySchema>,
) {
  const cursor = input.cursor ? decodeRedemptionCursor(input.cursor) : null;
  const rows = await rewardsRepository.listRedemptionLog(tx, {
    limit: input.limit,
    ...(input.status ? { status: input.status } : {}),
    ...(cursor ? { cursor } : {}),
  });

  const hasNextPage = rows.length > input.limit;
  const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: {
      items: pageRows.map((row) => ({
        id: row.id,
        rewardItemId: row.reward_item_id,
        rewardName: row.reward_name,
        rewardType: row.reward_type,
        membershipId: row.membership_id,
        memberLabel: row.member_label ?? row.membership_id,
        costAmount: row.cost_amount,
        status: row.status,
        redeemedAt: row.redeemed_at.toISOString(),
      })),
      nextCursor: hasNextPage && lastRow ? encodeRedemptionCursor(lastRow) : null,
    },
  };
}

export async function getMyRewards(tx: TenantTx, ctx: ServiceCtx) {
  const [currencies, items, balances, redemptions] = await Promise.all([
    rewardsRepository.listCurrencies(tx),
    rewardsRepository.listRewardItems(tx, { activeOnly: true }),
    rewardsRepository.listBalances(tx, ctx.actorMembershipId),
    rewardsRepository.listRedemptionsForMembership(tx, ctx.actorMembershipId),
  ]);

  const balanceByKey = new Map(balances.map((row) => [row.currency_key, row.balance]));

  return {
    data: {
      balances: currencies.map((currency) => ({
        currencyKey: currency.key,
        currencyName: currency.name,
        symbol: currency.symbol,
        balance: balanceByKey.get(currency.key) ?? 0,
      })),
      items: items.map(toRewardItemDto),
      redemptions: redemptions.map((row) => ({
        id: row.id,
        rewardName: row.reward_name,
        rewardType: row.reward_type,
        costAmount: row.cost_amount,
        status: row.status,
        redeemedAt: row.redeemed_at.toISOString(),
      })),
    },
  };
}

export async function redeemReward(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof redeemBodySchema>,
) {
  const item = await rewardsRepository.findRewardItemById(tx, input.rewardItemId);
  if (!item || item.status !== "ACTIVE") {
    throw rewardItemNotFound();
  }

  if (item.stock != null) {
    const decremented = await rewardsRepository.tryDecrementStock(tx, item.id);
    if (!decremented) {
      throw rewardOutOfStock();
    }
  }

  const balance = await rewardsRepository.tryDebitBalance(tx, {
    membershipId: ctx.actorMembershipId,
    currencyKey: item.cost_currency_key,
    amount: item.cost_amount,
  });

  if (balance == null) {
    throw insufficientBalance();
  }

  const payload = (item.reward_payload_json as RewardPayload | null) ?? {};
  const autoFulfilled =
    item.reward_type === "CONTENT_UNLOCK" || item.reward_type === "DISCOUNT_CODE";
  const status = autoFulfilled ? "fulfilled" : "pending_fulfillment";

  const redemptionId = await rewardsRepository.insertRedemption(tx, {
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    rewardItemId: item.id,
    costAmount: item.cost_amount,
    status,
  });

  if (item.reward_type === "CONTENT_UNLOCK" && payload.courseId) {
    await rewardsRepository.grantEnrollment(tx, {
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
      courseId: payload.courseId,
    });
  }

  await writeRewardsAudit(tx, ctx, {
    action: "reward.redeemed",
    targetType: "reward_redemption",
    targetId: redemptionId,
    before: null,
    after: {
      rewardItemId: item.id,
      rewardKey: item.key,
      membershipId: ctx.actorMembershipId,
      costAmount: item.cost_amount,
      status,
    },
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "reward.redeemed",
    aggregateType: "reward_redemption",
    aggregateId: redemptionId,
    payload: {
      redemptionId,
      rewardItemId: item.id,
      rewardKey: item.key,
      rewardType: item.reward_type,
      membershipId: ctx.actorMembershipId,
    },
    idempotencyKey: `reward.redeemed:${redemptionId}`,
  });

  return {
    data: {
      redemptionId,
      status,
      balance,
      code: item.reward_type === "DISCOUNT_CODE" ? (payload.code ?? null) : null,
    },
  };
}

/**
 * Engine hook: credit configured currencies when XP is awarded.
 * Earn rule `xpPerCoin` grants floor(points / xpPerCoin) coins per accrual.
 * Callers only pass points that were actually written to the ledger, so
 * event replays credit nothing.
 */
export async function creditCurrenciesForXp(
  tx: TenantTx,
  ctx: { tenantId: string },
  args: { membershipId: string; points: number },
): Promise<void> {
  if (args.points <= 0) {
    return;
  }

  const currencies = await rewardsRepository.listCurrencies(tx);
  for (const currency of currencies) {
    const earnRules = currency.earn_rules_json as CurrencyEarnRules | null;
    const xpPerCoin = earnRules?.xpPerCoin;
    if (!xpPerCoin || xpPerCoin <= 0) {
      continue;
    }

    const coins = Math.floor(args.points / xpPerCoin);
    if (coins <= 0) {
      continue;
    }

    await rewardsRepository.creditBalance(tx, {
      tenantId: ctx.tenantId,
      membershipId: args.membershipId,
      currencyKey: currency.key,
      amount: coins,
    });
  }
}
