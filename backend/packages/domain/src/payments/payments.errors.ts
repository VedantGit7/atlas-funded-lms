import { AtlasHttpError } from "@atlas/core/http/errors";

export function paymentOrderNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Payment order not found.",
  });
}
