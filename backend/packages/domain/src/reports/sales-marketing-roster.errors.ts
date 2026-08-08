import { AtlasHttpError } from "@atlas/core/http/errors";

export function salesMarketingProductNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Product not found.",
  });
}

export function salesMarketingCouponNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Coupon not found.",
  });
}

export function salesMarketingReferrerNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Referrer not found.",
  });
}

export function salesMarketingAffiliateNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Affiliate not found.",
  });
}

export function salesMarketingMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message,
  });
}

export function salesMarketingGroupFailed(message: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message,
  });
}
