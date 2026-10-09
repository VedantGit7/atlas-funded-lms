import { AtlasHttpError } from "@atlas/core/http/errors";

/** Errors and code handling shared by coupon administration, checkout and fulfilment. */

export function couponNotFound(message = "Coupon not found.") {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

export function validationError(message: string) {
  return new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message });
}

/** Coupon codes are matched case-insensitively and stored upper-case. */
export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}
