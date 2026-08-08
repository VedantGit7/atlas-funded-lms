import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  adjustWalletBodySchema,
  adjustWalletResponseSchema,
  myWalletResponseSchema,
  updateWalletConfigBodySchema,
  walletAccountDetailQuerySchema,
  walletAccountDetailResponseSchema,
  walletAccountsListQuerySchema,
  walletAccountsListResponseSchema,
  walletConfigResponseSchema,
  walletReasonSchema,
} from "./sales-wallet.schemas";
import {
  salesWalletRepository,
  type WalletConfigRow,
  type WalletRow,
} from "./sales-wallet.repository";

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function defaultConfig(): WalletConfigRow {
  return {
    id: "",
    enabled: false,
    credit_value_cents: 100,
    currency: "USD",
    max_balance_credits: null,
    max_credits_per_order: null,
    updated_at: new Date(0),
  };
}

function toConfigDto(row: WalletConfigRow | null) {
  const config = row ?? defaultConfig();
  return {
    enabled: config.enabled,
    creditValueCents: config.credit_value_cents,
    currency: config.currency,
    maxBalanceCredits: config.max_balance_credits,
    maxCreditsPerOrder: config.max_credits_per_order,
    updatedAt: row ? config.updated_at.toISOString() : null,
  };
}

function toAccountDto(row: WalletRow) {
  return {
    membershipId: row.membership_id,
    displayName: row.display_name ?? null,
    email: row.email ?? null,
    balanceCredits: row.balance_credits,
    earnedCredits: row.earned_credits,
    usedCredits: row.used_credits,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getWalletConfig(tx: TenantTx, _ctx: ServiceCtx) {
  return walletConfigResponseSchema.parse({
    data: toConfigDto(await salesWalletRepository.getConfig(tx)),
  });
}

export async function updateWalletConfig(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = updateWalletConfigBodySchema.parse(rawBody);
  await salesWalletRepository.upsertConfig(tx, {
    enabled: body.enabled,
    creditValueCents: body.creditValueCents,
    currency: body.currency.toUpperCase(),
    maxBalanceCredits: body.maxBalanceCredits ?? null,
    maxCreditsPerOrder: body.maxCreditsPerOrder ?? null,
    updatedByMembershipId: ctx.actorMembershipId,
  });
  return walletConfigResponseSchema.parse({
    data: toConfigDto(await salesWalletRepository.getConfig(tx)),
  });
}

export async function listWalletAccounts(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = walletAccountsListQuerySchema.parse(rawQuery ?? {});
  const rows = await salesWalletRepository.listWallets(tx, {
    ...(query.q ? { q: query.q } : {}),
    limit: query.limit,
  });
  return walletAccountsListResponseSchema.parse({
    data: { items: rows.map(toAccountDto) },
  });
}

function toTransactionDto(row: {
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
}) {
  return {
    id: row.id,
    direction: row.direction as "CREDIT" | "DEBIT",
    reason: walletReasonSchema.parse(row.reason),
    credits: row.credits,
    balanceAfter: row.balance_after,
    moneyCents: row.money_cents,
    currency: row.currency,
    paymentOrderId: row.payment_order_id,
    courseId: row.course_id,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getWalletAccountDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  membershipId: string,
  rawQuery: unknown,
) {
  const query = walletAccountDetailQuerySchema.parse(rawQuery ?? {});
  const account = await salesWalletRepository.findWalletAccountByMembership(tx, membershipId);
  if (!account) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Wallet account not found.",
    });
  }
  const transactions = await salesWalletRepository.listTransactions(tx, {
    membershipId,
    limit: query.limit,
  });
  return walletAccountDetailResponseSchema.parse({
    data: {
      account: toAccountDto(account),
      transactions: transactions.map(toTransactionDto),
    },
  });
}

export async function getMyWallet(tx: TenantTx, ctx: ServiceCtx) {
  const config = (await salesWalletRepository.getConfig(tx)) ?? defaultConfig();
  const wallet = await salesWalletRepository.ensureWallet(tx, ctx.actorMembershipId);
  const transactions = await salesWalletRepository.listTransactions(tx, {
    membershipId: ctx.actorMembershipId,
    limit: 50,
  });

  return myWalletResponseSchema.parse({
    data: {
      enabled: config.enabled,
      creditValueCents: config.credit_value_cents,
      currency: config.currency,
      maxCreditsPerOrder: config.max_credits_per_order,
      availableBalance: wallet.balance_credits,
      earnedCredits: wallet.earned_credits,
      usedCredits: wallet.used_credits,
      transactions: transactions.map(toTransactionDto),
    },
  });
}

/**
 * Credits a learner wallet (referral signup/purchase, admin goodwill, etc.).
 * Caps at maxBalanceCredits when configured.
 */
export async function creditWallet(
  tx: TenantTx,
  args: {
    membershipId: string;
    credits: number;
    reason: "REFERRAL_SIGNUP" | "REFERRAL_PURCHASE" | "ADMIN_ADJUST" | "OTHER";
    note?: string | null;
    createdByMembershipId?: string | null;
    currency?: string | null;
  },
) {
  if (args.credits <= 0) throw validationError("Credits must be positive.");
  const config = (await salesWalletRepository.getConfig(tx)) ?? defaultConfig();
  if (!config.enabled && args.reason !== "ADMIN_ADJUST") {
    throw validationError("Wallet is not enabled for this school.");
  }

  const wallet = await salesWalletRepository.ensureWallet(tx, args.membershipId);
  let nextBalance = wallet.balance_credits + args.credits;
  let applied = args.credits;
  if (config.max_balance_credits != null && nextBalance > config.max_balance_credits) {
    applied = Math.max(0, config.max_balance_credits - wallet.balance_credits);
    nextBalance = wallet.balance_credits + applied;
  }
  if (applied <= 0) {
    throw validationError("Wallet is already at the maximum credit balance.");
  }

  const moneyCents = applied * config.credit_value_cents;
  await salesWalletRepository.updateBalances(tx, {
    walletId: wallet.id,
    balanceCredits: nextBalance,
    earnedCredits: wallet.earned_credits + applied,
    usedCredits: wallet.used_credits,
  });
  await salesWalletRepository.insertTransaction(tx, {
    walletId: wallet.id,
    membershipId: args.membershipId,
    direction: "CREDIT",
    reason: args.reason,
    credits: applied,
    balanceAfter: nextBalance,
    moneyCents,
    currency: args.currency ?? config.currency,
    note: args.note ?? null,
    createdByMembershipId: args.createdByMembershipId ?? null,
  });

  return {
    appliedCredits: applied,
    balanceCredits: nextBalance,
  };
}

/**
 * Debits wallet for checkout spend. Returns money discount in cents.
 */
export async function spendWalletCredits(
  tx: TenantTx,
  args: {
    membershipId: string;
    credits: number;
    maxSpendableMoneyCents: number;
    paymentOrderId?: string | null;
    courseId?: string | null;
  },
): Promise<{ creditsSpent: number; discountCents: number }> {
  if (args.credits <= 0) {
    return { creditsSpent: 0, discountCents: 0 };
  }

  const config = await salesWalletRepository.getConfig(tx);
  if (!config?.enabled) {
    throw validationError("Wallet is not enabled for this school.");
  }
  if (config.credit_value_cents <= 0) {
    throw validationError("Wallet credit value is not configured.");
  }

  const wallet = await salesWalletRepository.ensureWallet(tx, args.membershipId);
  const maxByOrder =
    config.max_credits_per_order != null
      ? Math.min(args.credits, config.max_credits_per_order)
      : args.credits;
  const maxByBalance = Math.min(maxByOrder, wallet.balance_credits);
  const maxByMoney = Math.floor(args.maxSpendableMoneyCents / config.credit_value_cents);
  const creditsSpent = Math.max(0, Math.min(maxByBalance, maxByMoney));

  if (creditsSpent <= 0) {
    throw validationError("No wallet credits can be applied to this order.");
  }

  const discountCents = creditsSpent * config.credit_value_cents;
  const nextBalance = wallet.balance_credits - creditsSpent;

  await salesWalletRepository.updateBalances(tx, {
    walletId: wallet.id,
    balanceCredits: nextBalance,
    earnedCredits: wallet.earned_credits,
    usedCredits: wallet.used_credits + creditsSpent,
  });
  await salesWalletRepository.insertTransaction(tx, {
    walletId: wallet.id,
    membershipId: args.membershipId,
    direction: "DEBIT",
    reason: "CHECKOUT_SPEND",
    credits: creditsSpent,
    balanceAfter: nextBalance,
    moneyCents: discountCents,
    currency: config.currency,
    paymentOrderId: args.paymentOrderId ?? null,
    courseId: args.courseId ?? null,
  });

  return { creditsSpent, discountCents };
}

export async function previewWalletSpend(
  tx: TenantTx,
  args: {
    membershipId: string;
    creditsRequested: number;
    maxSpendableMoneyCents: number;
  },
) {
  const config = await salesWalletRepository.getConfig(tx);
  if (!config?.enabled) {
    return {
      enabled: false as const,
      availableBalance: 0,
      creditValueCents: 100,
      currency: "USD",
      maxCreditsPerOrder: null as number | null,
      creditsApplied: 0,
      discountCents: 0,
    };
  }

  const wallet = await salesWalletRepository.ensureWallet(tx, args.membershipId);
  const requested = Math.max(0, args.creditsRequested);
  const maxByOrder =
    config.max_credits_per_order != null
      ? Math.min(requested, config.max_credits_per_order)
      : requested;
  const maxByBalance = Math.min(maxByOrder, wallet.balance_credits);
  const maxByMoney = Math.floor(args.maxSpendableMoneyCents / config.credit_value_cents);
  const creditsApplied = Math.max(0, Math.min(maxByBalance, maxByMoney));

  return {
    enabled: true as const,
    availableBalance: wallet.balance_credits,
    creditValueCents: config.credit_value_cents,
    currency: config.currency,
    maxCreditsPerOrder: config.max_credits_per_order,
    creditsApplied,
    discountCents: creditsApplied * config.credit_value_cents,
  };
}

export async function adjustWalletByAdmin(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = adjustWalletBodySchema.parse(rawBody);
  if (body.direction === "CREDIT") {
    await creditWallet(tx, {
      membershipId: body.membershipId,
      credits: body.credits,
      reason: "ADMIN_ADJUST",
      note: body.note ?? null,
      createdByMembershipId: ctx.actorMembershipId,
    });
  } else {
    const config = (await salesWalletRepository.getConfig(tx)) ?? defaultConfig();
    const wallet = await salesWalletRepository.ensureWallet(tx, body.membershipId);
    if (body.credits > wallet.balance_credits) {
      throw validationError("Cannot debit more credits than the available balance.");
    }
    const nextBalance = wallet.balance_credits - body.credits;
    await salesWalletRepository.updateBalances(tx, {
      walletId: wallet.id,
      balanceCredits: nextBalance,
      earnedCredits: wallet.earned_credits,
      usedCredits: wallet.used_credits + body.credits,
    });
    await salesWalletRepository.insertTransaction(tx, {
      walletId: wallet.id,
      membershipId: body.membershipId,
      direction: "DEBIT",
      reason: "ADMIN_ADJUST",
      credits: body.credits,
      balanceAfter: nextBalance,
      moneyCents: body.credits * config.credit_value_cents,
      currency: config.currency,
      note: body.note ?? null,
      createdByMembershipId: ctx.actorMembershipId,
    });
  }

  const updated = await salesWalletRepository.findWalletAccountByMembership(
    tx,
    body.membershipId,
  );
  if (!updated) throw validationError("Wallet not found after adjustment.");
  return adjustWalletResponseSchema.parse({
    data: toAccountDto(updated),
  });
}
