import { AtlasHttpError } from "@atlas/core/http/errors";

export function paymentInvoiceNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Invoice not found.",
  });
}

export function paymentInvoiceAlreadyVoided() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "This invoice is already voided.",
  });
}

export function paymentInvoiceNotVoidable(message?: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: message ?? "This invoice cannot be voided.",
  });
}

export function paymentInstalmentPlanNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Instalment plan not found.",
  });
}

export function paymentInstalmentNotPayable() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "No payable instalment remains on this plan.",
  });
}

export function paymentInstalmentPlanNotCancellable(message?: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: message ?? "This instalment plan cannot be cancelled.",
  });
}

export function paymentGatewayNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Payment gateway not found.",
  });
}

export function paymentTransactionNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Payment transaction not found.",
  });
}

export function paymentTransactionNotRefundable(message?: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: message ?? "This payment cannot be refunded.",
  });
}
