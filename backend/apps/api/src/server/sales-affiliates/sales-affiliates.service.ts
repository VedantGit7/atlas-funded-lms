import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  changedPayoutFields,
  maskedPayoutView,
  openPayoutDetails,
  sealPayoutPatch,
} from "./affiliate-payout-details";
import { findCourseAuthProjection } from "../courses/courses.repository";
import {
  affiliateCommissionsListQuerySchema,
  affiliateCommissionsListResponseSchema,
  affiliateConfigResponseSchema,
  affiliatePartnerResponseSchema,
  affiliatePayoutDetailsResponseSchema,
  affiliatePayoutsListResponseSchema,
  affiliateProductsResponseSchema,
  affiliateRequestsListResponseSchema,
  affiliateSummaryResponseSchema,
  affiliatesListResponseSchema,
  createAffiliateBodySchema,
  affiliatePayoutsListQuerySchema,
  affiliateRequestsListQuerySchema,
  affiliatesListQuerySchema,
  joinAffiliateProgramBodySchema,
  markAffiliatePayoutPaidBodySchema,
  markAffiliatePayoutPaidResponseSchema,
  myAffiliateResponseSchema,
  publicAffiliateStatusResponseSchema,
  reviewAffiliateRequestBodySchema,
  reviewAffiliateRequestResponseSchema,
  updateAffiliateBodySchema,
  updateAffiliateConfigBodySchema,
  updateMyAffiliatePayoutBodySchema,
  upsertAffiliateProductBodySchema,
  type ResolveAffiliateCheckoutResult,
} from "./sales-affiliates.schemas";
import {
  normalizeAffiliateCode,
  salesAffiliatesRepository,
  type AffiliateCommissionRow,
  type AffiliateConfigRow,
  type AffiliateListRow,
  type AffiliatePayoutListRow,
  type AffiliateProductListRow,
  type AffiliateProductRow,
  type AffiliateRequestListRow,
  type AffiliateRow,
} from "./sales-affiliates.repository";

function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

function notFound(message = "Affiliate not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

function defaultConfig(): AffiliateConfigRow {
  return {
    id: "",
    enabled: false,
    access_mode: "PRIVATE",
    ask_admin: true,
    standard_discount_pct: 0,
    standard_commission_pct: 10,
    premium_discount_pct: 0,
    premium_commission_pct: 20,
    updated_at: new Date(0),
  };
}

function toConfigDto(row: AffiliateConfigRow | null) {
  const config = row ?? defaultConfig();
  return {
    enabled: config.enabled,
    accessMode: config.access_mode as "PUBLIC" | "PRIVATE",
    askAdmin: config.ask_admin,
    standardDiscountPct: config.standard_discount_pct,
    standardCommissionPct: config.standard_commission_pct,
    premiumDiscountPct: config.premium_discount_pct,
    premiumCommissionPct: config.premium_commission_pct,
    updatedAt: row ? config.updated_at.toISOString() : null,
  };
}

function toPartnerDto(tenantId: string, row: AffiliateListRow) {
  const payout = maskedPayoutView(openPayoutDetails(row, { tenantId, affiliateId: row.id }));
  return {
    id: row.id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    email: row.email,
    tier: row.tier as "STANDARD" | "PREMIUM",
    status: row.status as "ACTIVE" | "INACTIVE",
    couponCode: row.coupon_code,
    ...payout,
    unpaidCents: row.unpaid_cents,
    paidCents: row.paid_cents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toProductDto(row: AffiliateProductListRow) {
  return {
    courseId: row.course_id,
    courseTitle: row.course_title,
    enabled: row.enabled,
    standardDiscountPct: row.standard_discount_pct,
    standardCommissionPct: row.standard_commission_pct,
    premiumDiscountPct: row.premium_discount_pct,
    premiumCommissionPct: row.premium_commission_pct,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toRequestDto(row: AffiliateRequestListRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    email: row.email,
    status: row.status as "PENDING" | "APPROVED" | "REJECTED",
    note: row.note,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function toPayoutDto(row: AffiliatePayoutListRow) {
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    affiliateMembershipId: row.affiliate_membership_id,
    displayName: row.display_name,
    email: row.email,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    note: row.note,
    paidAt: row.paid_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function toCommissionDto(row: AffiliateCommissionRow) {
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    courseId: row.course_id,
    paymentOrderId: row.payment_order_id,
    couponCodeSnapshot: row.coupon_code_snapshot,
    tierSnapshot: row.tier_snapshot,
    orderAmountCents: row.order_amount_cents,
    discountCents: row.discount_cents,
    commissionCents: row.commission_cents,
    currency: row.currency,
    status: row.status as "UNPAID" | "PAID",
    createdAt: row.created_at.toISOString(),
  };
}

function resolveTierPercents(args: {
  config: AffiliateConfigRow;
  product: AffiliateProductRow | AffiliateProductListRow | null;
  tier: string;
}): { discountPct: number; commissionPct: number } {
  const isPremium = args.tier === "PREMIUM";
  if (args.product) {
    const discountPct = isPremium
      ? (args.product.premium_discount_pct ?? args.config.premium_discount_pct)
      : (args.product.standard_discount_pct ?? args.config.standard_discount_pct);
    const commissionPct = isPremium
      ? (args.product.premium_commission_pct ?? args.config.premium_commission_pct)
      : (args.product.standard_commission_pct ?? args.config.standard_commission_pct);
    return { discountPct, commissionPct };
  }
  return {
    discountPct: isPremium ? args.config.premium_discount_pct : args.config.standard_discount_pct,
    commissionPct: isPremium
      ? args.config.premium_commission_pct
      : args.config.standard_commission_pct,
  };
}

async function requireAffiliate(tx: TenantTx, id: string): Promise<AffiliateRow> {
  const row = await salesAffiliatesRepository.findAffiliateById(tx, id);
  if (!row) throw notFound();
  return row;
}

async function loadPartnerDto(tx: TenantTx, tenantId: string, affiliateId: string) {
  const rows = await salesAffiliatesRepository.listAffiliates(tx, {
    id: affiliateId,
    limit: 1,
    status: "ALL",
  });
  const row = rows[0];
  if (!row) throw notFound();
  return toPartnerDto(tenantId, row);
}

export async function getAffiliateSummary(tx: TenantTx, _ctx: ServiceCtx) {
  const row = await salesAffiliatesRepository.getSummary(tx);
  return affiliateSummaryResponseSchema.parse({
    data: {
      activePartners: row.active_partners,
      totalPartners: row.total_partners,
      pendingRequests: row.pending_requests,
      unpaidCents: row.unpaid_cents,
      paidCents: row.paid_cents,
      partnersWithUnpaid: row.partners_with_unpaid,
      enabledProducts: row.enabled_products,
    },
  });
}

export async function getAffiliateConfig(tx: TenantTx, _ctx: ServiceCtx) {
  return affiliateConfigResponseSchema.parse({
    data: toConfigDto(await salesAffiliatesRepository.getConfig(tx)),
  });
}

export async function updateAffiliateConfig(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = updateAffiliateConfigBodySchema.parse(rawBody);
  await salesAffiliatesRepository.upsertConfig(tx, {
    enabled: body.enabled,
    accessMode: body.accessMode,
    askAdmin: body.askAdmin,
    standardDiscountPct: body.standardDiscountPct,
    standardCommissionPct: body.standardCommissionPct,
    premiumDiscountPct: body.premiumDiscountPct,
    premiumCommissionPct: body.premiumCommissionPct,
    updatedByMembershipId: ctx.actorMembershipId,
  });
  return affiliateConfigResponseSchema.parse({
    data: toConfigDto(await salesAffiliatesRepository.getConfig(tx)),
  });
}

export async function listAffiliateProducts(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await salesAffiliatesRepository.listProducts(tx);
  return affiliateProductsResponseSchema.parse({
    data: { items: rows.map(toProductDto) },
  });
}

export async function upsertAffiliateProduct(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = upsertAffiliateProductBodySchema.parse(rawBody);
  const course = await findCourseAuthProjection({ tx, courseId: body.courseId });
  if (!course) throw validationError("Course not found.");

  await salesAffiliatesRepository.upsertProduct(tx, {
    courseId: body.courseId,
    enabled: body.enabled,
    standardDiscountPct: body.standardDiscountPct ?? null,
    standardCommissionPct: body.standardCommissionPct ?? null,
    premiumDiscountPct: body.premiumDiscountPct ?? null,
    premiumCommissionPct: body.premiumCommissionPct ?? null,
  });

  const rows = await salesAffiliatesRepository.listProducts(tx);
  const product = rows.find((row) => row.course_id === body.courseId);
  if (!product) throw validationError("Failed to save affiliate product.");
  return affiliateProductsResponseSchema.parse({
    data: { items: [toProductDto(product)] },
  });
}

export async function listAffiliates(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = affiliatesListQuerySchema.parse(rawQuery ?? {});
  const rows = await salesAffiliatesRepository.listAffiliates(tx, {
    ...(query.q ? { q: query.q } : {}),
    status: query.status,
    limit: query.limit,
  });
  return affiliatesListResponseSchema.parse({
    data: { items: rows.map((row) => toPartnerDto(ctx.tenantId, row)) },
  });
}

export async function createAffiliate(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createAffiliateBodySchema.parse(rawBody);
  const existing = await salesAffiliatesRepository.findAffiliateByMembership(tx, body.membershipId);
  if (existing) throw validationError("This member is already an affiliate.");

  const pending = await salesAffiliatesRepository.findPendingRequest(tx, body.membershipId);
  if (pending) {
    throw validationError("This member has a pending affiliate request.");
  }

  let couponCode: string;
  try {
    couponCode = await salesAffiliatesRepository.ensureUniqueCouponCode(tx, body.couponCode);
  } catch (error) {
    if (error instanceof Error && error.message === "Coupon code already in use.") {
      throw validationError("An affiliate with this coupon code already exists.");
    }
    throw validationError("Could not allocate a unique affiliate coupon code.");
  }

  const id = await salesAffiliatesRepository.insertAffiliate(tx, {
    membershipId: body.membershipId,
    tier: body.tier,
    status: body.status,
    couponCode,
    createdByMembershipId: ctx.actorMembershipId,
  });

  return affiliatePartnerResponseSchema.parse({
    data: await loadPartnerDto(tx, ctx.tenantId, id),
  });
}

export async function updateAffiliate(tx: TenantTx, ctx: ServiceCtx, id: string, rawBody: unknown) {
  const body = updateAffiliateBodySchema.parse(rawBody);
  await requireAffiliate(tx, id);

  const patch: {
    tier?: string;
    status?: string;
    couponCode?: string;
    payoutUpi?: string | null;
    payoutBankAccount?: string | null;
    payoutIfsc?: string | null;
    payoutAccountName?: string | null;
  } = {
    ...(body.tier !== undefined ? { tier: body.tier } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...sealPayoutPatch(body, { tenantId: ctx.tenantId, affiliateId: id }),
  };

  if (body.couponCode !== undefined) {
    const normalized = normalizeAffiliateCode(body.couponCode);
    if (!normalized) throw validationError("Invalid affiliate coupon code.");
    const collision = await salesAffiliatesRepository.findAffiliateByCode(tx, normalized);
    if (collision && collision.id !== id) {
      throw validationError("An affiliate with this coupon code already exists.");
    }
    patch.couponCode = normalized;
  }

  await salesAffiliatesRepository.updateAffiliate(tx, id, patch);
  await auditAffiliateChange(tx, ctx, id, "affiliate.partner.updated", {
    tier: body.tier,
    status: body.status,
    couponCode: patch.couponCode,
    payoutFieldsChanged: changedPayoutFields(body),
  });

  return affiliatePartnerResponseSchema.parse({
    data: await loadPartnerDto(tx, ctx.tenantId, id),
  });
}

export async function listAffiliateCommissions(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = affiliateCommissionsListQuerySchema.parse(rawQuery ?? {});
  const status = query.status === "ALL" ? undefined : query.status;
  const rows = await salesAffiliatesRepository.listCommissions(tx, {
    ...(query.affiliateId ? { affiliateId: query.affiliateId } : {}),
    ...(status ? { status } : {}),
    limit: query.limit,
  });
  return affiliateCommissionsListResponseSchema.parse({
    data: { items: rows.map(toCommissionDto) },
  });
}

export async function listAffiliateRequests(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = affiliateRequestsListQuerySchema.parse(rawQuery ?? {});
  const rows = await salesAffiliatesRepository.listRequests(tx, {
    status: query.status,
    limit: query.limit,
  });
  return affiliateRequestsListResponseSchema.parse({
    data: { items: rows.map(toRequestDto) },
  });
}

export async function reviewAffiliateRequest(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = reviewAffiliateRequestBodySchema.parse(rawBody);
  const request = await salesAffiliatesRepository.findRequestById(tx, id);
  if (!request) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Affiliate request not found.",
    });
  }
  if (request.status !== "PENDING") {
    throw validationError("This request has already been reviewed.");
  }

  if (body.action === "approve") {
    const existing = await salesAffiliatesRepository.findAffiliateByMembership(
      tx,
      request.membership_id,
    );
    if (!existing) {
      const couponCode = await salesAffiliatesRepository.ensureUniqueCouponCode(tx, null);
      await salesAffiliatesRepository.insertAffiliate(tx, {
        membershipId: request.membership_id,
        tier: "STANDARD",
        status: "ACTIVE",
        couponCode,
        createdByMembershipId: ctx.actorMembershipId,
      });
    }
    await salesAffiliatesRepository.updateRequestStatus(tx, id, {
      status: "APPROVED",
      note: body.note ?? null,
      reviewedByMembershipId: ctx.actorMembershipId,
    });
  } else {
    await salesAffiliatesRepository.updateRequestStatus(tx, id, {
      status: "REJECTED",
      note: body.note ?? null,
      reviewedByMembershipId: ctx.actorMembershipId,
    });
  }

  const rows = await salesAffiliatesRepository.listRequests(tx, { status: "ALL", limit: 100 });
  const updated = rows.find((row) => row.id === id);
  if (!updated) throw validationError("Failed to load reviewed request.");
  return reviewAffiliateRequestResponseSchema.parse({ data: toRequestDto(updated) });
}

export async function listAffiliatePayouts(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = affiliatePayoutsListQuerySchema.parse(rawQuery ?? {});
  const rows = await salesAffiliatesRepository.listPayouts(tx, {
    ...(query.affiliateId ? { affiliateId: query.affiliateId } : {}),
    limit: query.limit,
  });
  return affiliatePayoutsListResponseSchema.parse({
    data: { items: rows.map(toPayoutDto) },
  });
}

export async function markAffiliatePayoutPaid(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = markAffiliatePayoutPaidBodySchema.parse(rawBody);
  const affiliate = await requireAffiliate(tx, body.affiliateId);
  const unpaidCents = await salesAffiliatesRepository.sumUnpaidCommissions(tx, affiliate.id);
  if (unpaidCents <= 0) {
    throw validationError("No unpaid commissions for this affiliate.");
  }

  const commissions = await salesAffiliatesRepository.listCommissions(tx, {
    affiliateId: affiliate.id,
    status: "UNPAID",
    limit: 1,
  });
  const currency = commissions[0]?.currency ?? "USD";

  const payoutId = await salesAffiliatesRepository.insertPayout(tx, {
    affiliateId: affiliate.id,
    affiliateMembershipId: affiliate.membership_id,
    amountCents: unpaidCents,
    currency,
    note: body.note ?? null,
    markedByMembershipId: ctx.actorMembershipId,
  });

  await salesAffiliatesRepository.markCommissionsPaid(tx, {
    affiliateId: affiliate.id,
    payoutId,
  });

  const payout = await salesAffiliatesRepository.findPayoutById(tx, payoutId);
  if (!payout) throw validationError("Failed to record payout.");
  return markAffiliatePayoutPaidResponseSchema.parse({ data: toPayoutDto(payout) });
}

export async function getMyAffiliate(tx: TenantTx, ctx: ServiceCtx) {
  const config = (await salesAffiliatesRepository.getConfig(tx)) ?? defaultConfig();
  const affiliate = await salesAffiliatesRepository.findAffiliateByMembership(
    tx,
    ctx.actorMembershipId,
  );
  const pending = affiliate
    ? null
    : await salesAffiliatesRepository.findPendingRequest(tx, ctx.actorMembershipId);

  let status: "none" | "pending" | "active" | "inactive" = "none";
  if (affiliate) {
    status = affiliate.status === "ACTIVE" ? "active" : "inactive";
  } else if (pending) {
    status = "pending";
  }

  const products = await salesAffiliatesRepository.listProducts(tx);
  const myProducts = products
    .filter((product) => product.enabled)
    .map((product) => {
      const { discountPct, commissionPct } = resolveTierPercents({
        config,
        product,
        tier: affiliate?.tier ?? "STANDARD",
      });
      return {
        courseId: product.course_id,
        courseTitle: product.course_title,
        enabled: product.enabled,
        discountPct,
        commissionPct,
      };
    });

  const unpaidCents = affiliate
    ? await salesAffiliatesRepository.sumUnpaidCommissions(tx, affiliate.id)
    : 0;
  const paidCents = affiliate
    ? await salesAffiliatesRepository.sumPaidCommissions(tx, affiliate.id)
    : 0;

  return myAffiliateResponseSchema.parse({
    data: {
      enabled: config.enabled,
      accessMode: config.access_mode as "PUBLIC" | "PRIVATE",
      askAdmin: config.ask_admin,
      status,
      code: affiliate?.coupon_code ?? null,
      tier: affiliate ? (affiliate.tier as "STANDARD" | "PREMIUM") : null,
      products: myProducts,
      unpaidCents,
      paidCents,
      ...maskedPayoutView(
        affiliate
          ? openPayoutDetails(affiliate, { tenantId: ctx.tenantId, affiliateId: affiliate.id })
          : { upi: null, bankAccount: null, ifsc: null, accountName: null },
      ),
      sharePath: affiliate?.coupon_code
        ? `/?affiliate=${encodeURIComponent(affiliate.coupon_code)}`
        : null,
    },
  });
}

export async function joinAffiliateProgram(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  joinAffiliateProgramBodySchema.parse(rawBody ?? {});
  const config = (await salesAffiliatesRepository.getConfig(tx)) ?? defaultConfig();
  if (!config.enabled) {
    throw validationError("The affiliate program is not enabled for this school.");
  }

  const existing = await salesAffiliatesRepository.findAffiliateByMembership(
    tx,
    ctx.actorMembershipId,
  );
  if (existing) {
    throw validationError("You are already enrolled in the affiliate program.");
  }

  const pending = await salesAffiliatesRepository.findPendingRequest(tx, ctx.actorMembershipId);
  if (pending) {
    throw validationError("You already have a pending affiliate request.");
  }

  if (config.access_mode === "PRIVATE" && !config.ask_admin) {
    throw validationError("The affiliate program is invite-only.");
  }

  if (config.access_mode === "PUBLIC" && !config.ask_admin) {
    const couponCode = await salesAffiliatesRepository.ensureUniqueCouponCode(tx, null);
    await salesAffiliatesRepository.insertAffiliate(tx, {
      membershipId: ctx.actorMembershipId,
      tier: "STANDARD",
      status: "ACTIVE",
      couponCode,
      createdByMembershipId: null,
    });
  } else {
    await salesAffiliatesRepository.insertRequest(tx, {
      membershipId: ctx.actorMembershipId,
    });
  }

  return getMyAffiliate(tx, ctx);
}

export async function updateMyAffiliatePayoutDetails(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = updateMyAffiliatePayoutBodySchema.parse(rawBody);
  const affiliate = await salesAffiliatesRepository.findAffiliateByMembership(
    tx,
    ctx.actorMembershipId,
  );
  if (!affiliate) {
    throw validationError("You are not an affiliate.");
  }

  // Omitted fields keep their value: screens show masked values and never send
  // them back, so "not sent" must not mean "erase".
  const patch = sealPayoutPatch(body, { tenantId: ctx.tenantId, affiliateId: affiliate.id });
  const changed = changedPayoutFields(body);
  if (changed.length > 0) {
    await salesAffiliatesRepository.updateAffiliate(tx, affiliate.id, patch);
    await auditAffiliateChange(tx, ctx, affiliate.id, "affiliate.payout_details.updated", {
      payoutFieldsChanged: changed,
      changedBy: "affiliate",
    });
  }

  return getMyAffiliate(tx, ctx);
}

/**
 * Full payout details, for an admin paying the affiliate (audit M6). Every
 * call is audited; the route requires step-up MFA.
 */
export async function revealAffiliatePayoutDetails(
  tx: TenantTx,
  ctx: ServiceCtx,
  affiliateId: string,
) {
  const affiliate = await requireAffiliate(tx, affiliateId);
  const details = openPayoutDetails(affiliate, { tenantId: ctx.tenantId, affiliateId });
  await auditAffiliateChange(tx, ctx, affiliateId, "affiliate.payout_details.revealed", {
    fieldsPresent: Object.entries(details)
      .filter(([, value]) => value != null)
      .map(([field]) => field),
  });
  return affiliatePayoutDetailsResponseSchema.parse({
    data: {
      affiliateId,
      payoutUpi: details.upi,
      payoutBankAccount: details.bankAccount,
      payoutIfsc: details.ifsc,
      payoutAccountName: details.accountName,
    },
  });
}

/** Audit entries for affiliate changes; never carry payout values. */
async function auditAffiliateChange(
  tx: TenantTx,
  ctx: ServiceCtx,
  affiliateId: string,
  action: string,
  after: Record<string, unknown>,
): Promise<void> {
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action,
      target: { type: "sales_affiliate", id: affiliateId },
      before: null,
      after: Object.fromEntries(Object.entries(after).filter(([, value]) => value !== undefined)),
      metadata: {},
    },
  );
}

export async function getPublicAffiliateStatus(tx: TenantTx) {
  const config = await salesAffiliatesRepository.getConfig(tx);
  const defaults = defaultConfig();
  return publicAffiliateStatusResponseSchema.parse({
    data: {
      enabled: Boolean(config?.enabled),
      accessMode: (config?.access_mode ?? defaults.access_mode) as "PUBLIC" | "PRIVATE",
      askAdmin: config?.ask_admin ?? defaults.ask_admin,
    },
  });
}

export async function resolveAffiliateForCheckout(
  tx: TenantTx,
  args: {
    code: string;
    courseId: string;
    buyerMembershipId?: string;
    originalAmountCents: number;
  },
): Promise<ResolveAffiliateCheckoutResult | null> {
  const config = await salesAffiliatesRepository.getConfig(tx);
  if (!config?.enabled) return null;

  const code = normalizeAffiliateCode(args.code);
  if (!code) return null;

  const affiliate = await salesAffiliatesRepository.findAffiliateByCode(tx, code);
  if (!affiliate || affiliate.status !== "ACTIVE") return null;

  if (args.buyerMembershipId && affiliate.membership_id === args.buyerMembershipId) {
    throw validationError("You cannot use your own affiliate code.");
  }

  const product = await salesAffiliatesRepository.findProductByCourse(tx, args.courseId);
  if (!product || !product.enabled) return null;

  const { discountPct, commissionPct } = resolveTierPercents({
    config,
    product,
    tier: affiliate.tier,
  });

  const discountCents = Math.floor((args.originalAmountCents * discountPct) / 100);

  return {
    affiliate: {
      id: affiliate.id,
      membership_id: affiliate.membership_id,
      tier: affiliate.tier,
      coupon_code: affiliate.coupon_code,
    },
    discountPct,
    commissionPct,
    discountCents,
  };
}

export async function applyAffiliateCommission(
  tx: TenantTx,
  args: {
    paymentOrderId: string;
    buyerMembershipId: string;
    courseId: string;
    code: string;
    orderAmountCents: number;
    discountCents: number;
    currency: string;
  },
): Promise<{ applied: boolean; commissionCents: number }> {
  const config = await salesAffiliatesRepository.getConfig(tx);
  if (!config?.enabled) return { applied: false, commissionCents: 0 };

  const code = normalizeAffiliateCode(args.code);
  if (!code) return { applied: false, commissionCents: 0 };

  const affiliate = await salesAffiliatesRepository.findAffiliateByCode(tx, code);
  if (!affiliate || affiliate.status !== "ACTIVE") {
    return { applied: false, commissionCents: 0 };
  }

  if (affiliate.membership_id === args.buyerMembershipId) {
    return { applied: false, commissionCents: 0 };
  }

  const product = await salesAffiliatesRepository.findProductByCourse(tx, args.courseId);
  if (!product || !product.enabled) {
    return { applied: false, commissionCents: 0 };
  }

  const { commissionPct } = resolveTierPercents({
    config,
    product,
    tier: affiliate.tier,
  });

  const commissionCents = Math.floor((args.orderAmountCents * commissionPct) / 100);
  if (commissionCents <= 0) {
    return { applied: false, commissionCents: 0 };
  }

  const inserted = await salesAffiliatesRepository.insertCommission(tx, {
    affiliateId: affiliate.id,
    affiliateMembershipId: affiliate.membership_id,
    buyerMembershipId: args.buyerMembershipId,
    courseId: args.courseId,
    paymentOrderId: args.paymentOrderId,
    couponCodeSnapshot: affiliate.coupon_code,
    tierSnapshot: affiliate.tier,
    orderAmountCents: args.orderAmountCents,
    discountCents: args.discountCents,
    commissionCents,
    currency: args.currency,
  });

  return { applied: inserted, commissionCents };
}
