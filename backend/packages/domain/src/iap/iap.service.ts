import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  readCourseStorePricingFromMetadata,
  toPublicStorePlatformPricing,
} from "./course-store-pricing";
import {
  courseStorePricingResponseSchema,
  verifyIapBodySchema,
  verifyIapResponseSchema,
} from "./iap.dto";
import {
  iapCourseNotFoundError,
  iapProductMismatchError,
  iapValidationError,
  iapVerificationFailedError,
} from "./iap.errors";
import { getIapVerifier } from "./iap.registry";
import { iapRepository } from "./iap.repository";

type CourseIapMetadata = {
  kind: "course_iap";
  courseId: string;
  courseTitle: string;
  productTitle: string;
  productType: "course";
  platform: "ios" | "android";
  productId: string;
  environment: "sandbox" | "production";
  originalAmountCents: number;
  discountCents: number;
  walletCreditsApplied: number;
  walletDiscountCents: number;
  taxAmountCents: number;
  amountAfterCouponCents: number;
  finalAmountCents: number;
  fulfillmentApplied?: boolean;
};

function asCourseIapMetadata(value: unknown): CourseIapMetadata | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record["kind"] !== "course_iap") return null;
  if (typeof record["courseId"] !== "string") return null;
  if (record["platform"] !== "ios" && record["platform"] !== "android") return null;
  return {
    kind: "course_iap",
    courseId: record["courseId"],
    courseTitle: typeof record["courseTitle"] === "string" ? record["courseTitle"] : "",
    productTitle: typeof record["productTitle"] === "string" ? record["productTitle"] : "",
    productType: "course",
    platform: record["platform"],
    productId: typeof record["productId"] === "string" ? record["productId"] : "",
    environment: record["environment"] === "sandbox" ? "sandbox" : "production",
    originalAmountCents: Number(record["originalAmountCents"] ?? 0),
    discountCents: Number(record["discountCents"] ?? 0),
    walletCreditsApplied: Number(record["walletCreditsApplied"] ?? 0),
    walletDiscountCents: Number(record["walletDiscountCents"] ?? 0),
    taxAmountCents: Number(record["taxAmountCents"] ?? 0),
    amountAfterCouponCents: Number(record["amountAfterCouponCents"] ?? 0),
    finalAmountCents: Number(record["finalAmountCents"] ?? 0),
    fulfillmentApplied: record["fulfillmentApplied"] === true,
  };
}

async function fulfillIapOrder(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    orderId: string;
    courseId: string;
    membershipId: string;
  },
): Promise<{ enrollmentId: string; created: boolean; paymentOrderId: string }> {
  await iapRepository.markOrderPaid(tx, {
    orderId: args.orderId,
    metadataPatch: { fulfillmentApplied: true },
  });

  const enrollment = await iapRepository.insertEnrollment(tx, {
    tenantId: ctx.tenantId,
    courseId: args.courseId,
    membershipId: args.membershipId,
  });

  return {
    enrollmentId: enrollment.id,
    created: enrollment.created,
    paymentOrderId: args.orderId,
  };
}

export async function verifyIapAndUnlock(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = verifyIapBodySchema.parse(rawBody);
  const course = await iapRepository.findCourseById(tx, body.courseId);
  if (!course || course.status !== "PUBLISHED") {
    throw iapCourseNotFoundError();
  }

  const storePricing = readCourseStorePricingFromMetadata(course.metadata_json);
  const platformPricing = storePricing[body.platform];
  if (!platformPricing.enabled || platformPricing.productId !== body.productId) {
    throw iapProductMismatchError();
  }

  const verifier = getIapVerifier(body.platform);
  const verified = await verifier.verify({
    productId: body.productId,
    ...(body.signedTransaction != null ? { signedTransaction: body.signedTransaction } : {}),
    ...(body.receiptData != null ? { receiptData: body.receiptData } : {}),
    ...(body.purchaseToken != null ? { purchaseToken: body.purchaseToken } : {}),
    ...(body.packageName != null ? { packageName: body.packageName } : {}),
  });

  if (!verified.ok) {
    throw iapVerificationFailedError();
  }

  const existing = await iapRepository.findPaymentOrderByExternalId(
    tx,
    verified.externalTransactionId,
  );

  if (existing) {
    const metadata = asCourseIapMetadata(existing.metadata_json);
    if (metadata && metadata.courseId !== body.courseId) {
      throw iapValidationError("This purchase is already linked to a different course.");
    }
    if (existing.membership_id && existing.membership_id !== ctx.actorMembershipId) {
      throw iapValidationError("This purchase belongs to a different learner.");
    }

    const fulfilled = await fulfillIapOrder(tx, ctx, {
      orderId: existing.id,
      courseId: body.courseId,
      membershipId: ctx.actorMembershipId,
    });

    return verifyIapResponseSchema.parse({
      data: {
        enrollmentId: fulfilled.enrollmentId,
        paymentOrderId: fulfilled.paymentOrderId,
        created: fulfilled.created,
        platform: body.platform,
        environment: verified.environment,
        externalTransactionId: verified.externalTransactionId,
        productId: verified.productId,
      },
    });
  }

  const amountCents = platformPricing.priceTierHintCents ?? 0;
  const gatewayKey = body.platform === "ios" ? "apple_iap" : "google_play";
  const metadata: CourseIapMetadata = {
    kind: "course_iap",
    courseId: course.id,
    courseTitle: course.title,
    productTitle: course.title,
    productType: "course",
    platform: body.platform,
    productId: body.productId,
    environment: verified.environment,
    originalAmountCents: amountCents,
    discountCents: 0,
    walletCreditsApplied: 0,
    walletDiscountCents: 0,
    taxAmountCents: 0,
    amountAfterCouponCents: amountCents,
    finalAmountCents: amountCents,
  };

  const order = await iapRepository.insertPendingIapOrder(tx, {
    membershipId: ctx.actorMembershipId,
    externalId: verified.externalTransactionId,
    amountCents,
    currency: "USD",
    gatewayKey,
    productTitle: course.title,
    metadataJson: metadata,
  });

  const fulfilled = await fulfillIapOrder(tx, ctx, {
    orderId: order.id,
    courseId: course.id,
    membershipId: ctx.actorMembershipId,
  });

  return verifyIapResponseSchema.parse({
    data: {
      enrollmentId: fulfilled.enrollmentId,
      paymentOrderId: fulfilled.paymentOrderId,
      created: fulfilled.created,
      platform: body.platform,
      environment: verified.environment,
      externalTransactionId: verified.externalTransactionId,
      productId: verified.productId,
    },
  });
}

export async function getCourseStorePricing(tx: TenantTx, _ctx: ServiceCtx, courseId: string) {
  const course = await iapRepository.findCourseById(tx, courseId);
  if (!course || course.status !== "PUBLISHED") {
    throw iapCourseNotFoundError();
  }

  const pricing = readCourseStorePricingFromMetadata(course.metadata_json);

  return courseStorePricingResponseSchema.parse({
    data: {
      courseId: course.id,
      ios: toPublicStorePlatformPricing(pricing.ios),
      android: toPublicStorePlatformPricing(pricing.android),
    },
  });
}
