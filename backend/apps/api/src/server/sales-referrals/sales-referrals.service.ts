import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { creditWallet } from "../sales-wallet/sales-wallet.service";
import { salesWalletRepository } from "../sales-wallet/sales-wallet.repository";
import {
  myReferralResponseSchema,
  publicReferralStatusResponseSchema,
  referralConfigResponseSchema,
  referralStatsQuerySchema,
  referralStatsResponseSchema,
  updateReferralConfigBodySchema,
} from "./sales-referrals.schemas";
import {
  normalizeReferralCode,
  salesReferralsRepository,
  type ReferralConfigRow,
} from "./sales-referrals.repository";

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function defaultConfig(): ReferralConfigRow {
  return {
    id: "",
    enabled: false,
    referrer_signup_credits: 0,
    referee_signup_credits: 0,
    referrer_purchase_credits: 0,
    max_referrals: null,
    updated_at: new Date(0),
  };
}

async function isWalletEnabled(tx: TenantTx): Promise<boolean> {
  const wallet = await salesWalletRepository.getConfig(tx);
  return Boolean(wallet?.enabled);
}

function toConfigDto(row: ReferralConfigRow | null, walletEnabled: boolean) {
  const config = row ?? defaultConfig();
  return {
    enabled: config.enabled,
    referrerSignupCredits: config.referrer_signup_credits,
    refereeSignupCredits: config.referee_signup_credits,
    referrerPurchaseCredits: config.referrer_purchase_credits,
    maxReferrals: config.max_referrals,
    walletEnabled,
    updatedAt: row ? config.updated_at.toISOString() : null,
  };
}

async function softCreditWallet(
  tx: TenantTx,
  args: {
    membershipId: string;
    credits: number;
    reason: "REFERRAL_SIGNUP" | "REFERRAL_PURCHASE";
    note: string;
  },
): Promise<number> {
  if (args.credits <= 0) return 0;
  try {
    const result = await creditWallet(tx, {
      membershipId: args.membershipId,
      credits: args.credits,
      reason: args.reason,
      note: args.note,
    });
    return result.appliedCredits;
  } catch (error) {
    if (error instanceof AtlasHttpError && error.status === 400) {
      return 0;
    }
    throw error;
  }
}

export async function getReferralConfig(tx: TenantTx, _ctx: ServiceCtx) {
  const walletEnabled = await isWalletEnabled(tx);
  return referralConfigResponseSchema.parse({
    data: toConfigDto(await salesReferralsRepository.getConfig(tx), walletEnabled),
  });
}

export async function updateReferralConfig(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = updateReferralConfigBodySchema.parse(rawBody);
  const walletEnabled = await isWalletEnabled(tx);
  if (body.enabled && !walletEnabled) {
    throw validationError("Enable Wallet before turning on Referral Codes.");
  }

  await salesReferralsRepository.upsertConfig(tx, {
    enabled: body.enabled,
    referrerSignupCredits: body.referrerSignupCredits,
    refereeSignupCredits: body.refereeSignupCredits,
    referrerPurchaseCredits: body.referrerPurchaseCredits,
    maxReferrals: body.maxReferrals ?? null,
    updatedByMembershipId: ctx.actorMembershipId,
  });

  return referralConfigResponseSchema.parse({
    data: toConfigDto(await salesReferralsRepository.getConfig(tx), walletEnabled),
  });
}

export async function listReferralStats(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = referralStatsQuerySchema.parse(rawQuery ?? {});
  const rows = await salesReferralsRepository.listStats(tx, {
    ...(query.q ? { q: query.q } : {}),
    limit: query.limit,
    sort: query.sort,
  });
  return referralStatsResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        displayName: row.display_name,
        email: row.email,
        code: row.code,
        successfulReferrals: row.successful_referrals,
        signupCreditsEarned: row.signup_credits_earned,
        purchaseCreditsEarned: row.purchase_credits_earned,
        createdAt: row.created_at.toISOString(),
      })),
    },
  });
}

export async function getMyReferral(tx: TenantTx, ctx: ServiceCtx) {
  const config = (await salesReferralsRepository.getConfig(tx)) ?? defaultConfig();
  const walletEnabled = await isWalletEnabled(tx);
  const enabled = config.enabled && walletEnabled;

  if (!enabled) {
    return myReferralResponseSchema.parse({
      data: {
        enabled: false,
        walletEnabled,
        code: null,
        sharePath: null,
        successfulReferrals: 0,
        totalRewardsEarned: 0,
        referrerSignupCredits: config.referrer_signup_credits,
        refereeSignupCredits: config.referee_signup_credits,
        referrerPurchaseCredits: config.referrer_purchase_credits,
        maxReferrals: config.max_referrals,
        remainingReferrals: null,
      },
    });
  }

  const codeRow = await salesReferralsRepository.ensureCodeForMembership(tx, ctx.actorMembershipId);
  const successfulReferrals = await salesReferralsRepository.countSuccessfulReferrals(
    tx,
    ctx.actorMembershipId,
  );
  const totalRewardsEarned = await salesReferralsRepository.sumRewardsForReferrer(
    tx,
    ctx.actorMembershipId,
  );
  const remainingReferrals =
    config.max_referrals == null ? null : Math.max(0, config.max_referrals - successfulReferrals);

  return myReferralResponseSchema.parse({
    data: {
      enabled: true,
      walletEnabled,
      code: codeRow.code,
      sharePath: `/signup?ref=${encodeURIComponent(codeRow.code)}`,
      successfulReferrals,
      totalRewardsEarned,
      referrerSignupCredits: config.referrer_signup_credits,
      refereeSignupCredits: config.referee_signup_credits,
      referrerPurchaseCredits: config.referrer_purchase_credits,
      maxReferrals: config.max_referrals,
      remainingReferrals,
    },
  });
}

export async function getPublicReferralStatus(tx: TenantTx) {
  const config = await salesReferralsRepository.getConfig(tx);
  const walletEnabled = await isWalletEnabled(tx);
  return publicReferralStatusResponseSchema.parse({
    data: {
      enabled: Boolean(config?.enabled) && walletEnabled,
      walletEnabled,
    },
  });
}

/**
 * Persist a referral code for email-verification signup flows so it can be
 * claimed when the membership is provisioned on confirm/login.
 */
export async function stashReferralCodeForSignup(
  tx: TenantTx,
  args: { emailNormalized: string; referralCode: string },
) {
  const config = (await salesReferralsRepository.getConfig(tx)) ?? defaultConfig();
  const walletEnabled = await isWalletEnabled(tx);
  if (!config.enabled || !walletEnabled) {
    throw validationError("Referral codes are not enabled for this school.");
  }

  const code = normalizeReferralCode(args.referralCode);
  if (!code) throw validationError("Referral code is required.");

  const codeRow = await salesReferralsRepository.findCodeByValue(tx, code);
  if (!codeRow) throw validationError("Referral code is invalid.");

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await salesReferralsRepository.upsertPending(tx, {
    emailNormalized: args.emailNormalized.trim().toLowerCase(),
    code,
    expiresAt,
  });
}

/**
 * Attribute a newly created learner membership to a referral code and grant
 * signup credits (referrer + referee) into wallets.
 */
export async function applyReferralForNewMembership(
  tx: TenantTx,
  args: {
    refereeMembershipId: string;
    emailNormalized: string;
    referralCode?: string | null;
  },
): Promise<{ applied: boolean }> {
  const config = (await salesReferralsRepository.getConfig(tx)) ?? defaultConfig();
  const walletEnabled = await isWalletEnabled(tx);
  if (!config.enabled || !walletEnabled) {
    return { applied: false };
  }

  const existing = await salesReferralsRepository.findAttributionByReferee(
    tx,
    args.refereeMembershipId,
  );
  if (existing) return { applied: false };

  let code =
    args.referralCode != null && args.referralCode.trim()
      ? normalizeReferralCode(args.referralCode)
      : null;
  if (!code) {
    code = await salesReferralsRepository.takePending(
      tx,
      args.emailNormalized.trim().toLowerCase(),
    );
  } else {
    // Consume any pending row so it cannot be reused.
    await salesReferralsRepository.takePending(tx, args.emailNormalized.trim().toLowerCase());
  }
  if (!code) return { applied: false };

  const codeRow = await salesReferralsRepository.findCodeByValue(tx, code);
  if (!codeRow) {
    if (args.referralCode) {
      throw validationError("Referral code is invalid.");
    }
    return { applied: false };
  }

  if (codeRow.membership_id === args.refereeMembershipId) {
    throw validationError("You cannot use your own referral code.");
  }

  const successful = await salesReferralsRepository.countSuccessfulReferrals(
    tx,
    codeRow.membership_id,
  );
  if (config.max_referrals != null && successful >= config.max_referrals) {
    throw validationError("This referral code has reached its maximum referral limit.");
  }

  const attributionId = await salesReferralsRepository.insertAttribution(tx, {
    referralCodeId: codeRow.id,
    referrerMembershipId: codeRow.membership_id,
    refereeMembershipId: args.refereeMembershipId,
    codeSnapshot: codeRow.code,
    signupCreditedAt: null,
  });

  // Both credits are applied for their side effect. The return values used to
  // feed a branch that decided whether to mark the signup credited; that branch
  // is gone (see below), but the wallet writes must still happen.
  await softCreditWallet(tx, {
    membershipId: codeRow.membership_id,
    credits: config.referrer_signup_credits,
    reason: "REFERRAL_SIGNUP",
    note: `referral_signup:referrer:${attributionId}`,
  });
  await softCreditWallet(tx, {
    membershipId: args.refereeMembershipId,
    credits: config.referee_signup_credits,
    reason: "REFERRAL_SIGNUP",
    note: `referral_signup:referee:${attributionId}`,
  });

  // The signup is marked credited unconditionally. This used to be an
  // if / else-if / else chain whose three branches all made this same call with
  // the same arguments — and whose `else if` was unreachable anyway, because
  // `config.referrer_signup_credits === 0` already satisfies the first branch.
  //
  // The behaviour is deliberate, not an oversight: even when credits are
  // configured and the wallet soft-fails (e.g. the balance cap is hit), the
  // referral still counts so `max_referrals` cannot be farmed by forcing
  // failures.
  await salesReferralsRepository.markSignupCredited(tx, attributionId);

  return { applied: true };
}

/**
 * Grant referrer purchase credits after a referred learner completes checkout.
 */
export async function applyReferralPurchaseCredits(
  tx: TenantTx,
  args: {
    refereeMembershipId: string;
    paymentOrderId: string;
  },
): Promise<{ appliedCredits: number }> {
  const config = (await salesReferralsRepository.getConfig(tx)) ?? defaultConfig();
  const walletEnabled = await isWalletEnabled(tx);
  if (!config.enabled || !walletEnabled || config.referrer_purchase_credits <= 0) {
    return { appliedCredits: 0 };
  }

  if (await salesReferralsRepository.hasPurchaseCreditForOrder(tx, args.paymentOrderId)) {
    return { appliedCredits: 0 };
  }

  const attribution = await salesReferralsRepository.findAttributionByReferee(
    tx,
    args.refereeMembershipId,
  );
  if (!attribution || !attribution.signup_credited_at) {
    return { appliedCredits: 0 };
  }

  const applied = await softCreditWallet(tx, {
    membershipId: attribution.referrer_membership_id,
    credits: config.referrer_purchase_credits,
    reason: "REFERRAL_PURCHASE",
    note: `referral_purchase:${args.paymentOrderId}`,
  });

  await salesReferralsRepository.insertPurchaseCredit(tx, {
    attributionId: attribution.id,
    paymentOrderId: args.paymentOrderId,
    referrerMembershipId: attribution.referrer_membership_id,
    refereeMembershipId: args.refereeMembershipId,
    creditsApplied: applied,
  });

  return { appliedCredits: applied };
}
