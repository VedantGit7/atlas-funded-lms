import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "../payment-provider";

export type RazorpayAdapterConfig = {
  /** Razorpay Key ID (publishable). */
  keyId: string;
  /** Razorpay Key Secret. */
  secretKey: string;
  webhookSecret: string;
};

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
  notes?: Record<string, string> | null;
};

type RazorpayPayment = {
  id: string;
  order_id?: string | null;
  status?: string | null;
  /** Checkout.js notes. Browser-controlled: never read (audit finding C1). */
  notes?: Record<string, string> | null;
  amount?: number;
  currency?: string | null;
};

type RazorpayRefund = {
  id: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
  receipt?: string | null;
  notes?: Record<string, string> | null;
};

type RazorpayPaymentsList = {
  items?: RazorpayPayment[];
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: {
      entity?: RazorpayOrder & { notes?: Record<string, string> | null; amount_paid?: number };
    };
    refund?: { entity?: RazorpayRefund };
  };
};

/**
 * Our payment order id, for diagnostics only. Read from the Razorpay ORDER's notes, which the
 * server set via the Orders API and the browser cannot change. The payment's notes are ignored:
 * Checkout.js copies client-supplied notes onto the payment (audit finding C1).
 */
function serverOrderNote(order: { notes?: Record<string, string> | null } | undefined) {
  return order?.notes?.["paymentOrderId"] ?? null;
}

/** Captured amount and currency, preferring the payment entity over the order aggregate. */
function capturedAmount(
  payment: RazorpayPayment | undefined,
  order: (RazorpayOrder & { amount_paid?: number }) | undefined,
): { amountCents: number | null; currency: string | null } {
  const amount = payment?.amount ?? order?.amount_paid ?? null;
  const currency = payment?.currency ?? order?.currency ?? null;
  return {
    amountCents: typeof amount === "number" && Number.isSafeInteger(amount) ? amount : null,
    currency: typeof currency === "string" && currency ? currency.toUpperCase() : null,
  };
}

function basicAuthHeader(keyId: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${keyId}:${secretKey}`).toString("base64")}`;
}

async function razorpayFetch<T>(
  config: RazorpayAdapterConfig,
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const method = init?.method ?? "GET";
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: basicAuthHeader(config.keyId, config.secretKey),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const message =
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error?: { description?: string } }).error?.description === "string"
        ? (json as { error: { description: string } }).error.description
        : `Razorpay API ${method} ${path} failed (${response.status}).`;
    throw new Error(message);
  }

  return json as T;
}

function verifyRazorpayWebhookSignature(args: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): void {
  if (!args.webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured for webhook verification.");
  }
  const expected = createHmac("sha256", args.webhookSecret).update(args.rawBody).digest("hex");
  const provided = args.signature.trim();
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    throw new Error("Invalid Razorpay webhook signature.");
  }
}

/** Exported for unit tests. */
export function computeRazorpayWebhookSignature(rawBody: string, webhookSecret: string): string {
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

function normalizeRefund(refund: RazorpayRefund, externalId?: string): RefundResult {
  if (
    !refund.id ||
    !Number.isSafeInteger(refund.amount) ||
    refund.amount <= 0 ||
    typeof refund.currency !== "string" ||
    !/^[a-z]{3}$/i.test(refund.currency) ||
    !refund.payment_id
  ) {
    throw new Error("Razorpay returned an invalid refund record.");
  }
  return {
    refundId: refund.id,
    status:
      refund.status === "processed"
        ? "succeeded"
        : refund.status === "failed"
          ? "failed"
          : "pending",
    amountCents: refund.amount,
    currency: refund.currency.toUpperCase(),
    externalId: externalId ?? refund.notes?.["atlasPaymentExternalId"] ?? refund.payment_id,
    intentId: refund.notes?.["atlasRefundIntentId"] ?? refund.receipt ?? null,
  };
}

/**
 * Razorpay HTTP API is confined to this adapter. Business logic must depend only on PaymentProvider.
 * Checkout uses Orders API; the browser opens Checkout.js with the returned clientCheckout payload.
 */
export function createRazorpayPaymentProvider(config: RazorpayAdapterConfig): PaymentProvider {
  async function resolvePayment(externalId: string, reconciliation = false): Promise<string> {
    if (!externalId.startsWith("order_")) return externalId;
    const list = await razorpayFetch<RazorpayPaymentsList>(
      config,
      `/orders/${encodeURIComponent(externalId)}/payments`,
    );
    // Fully refunded payments may no longer be captured when reconciling.
    const payment = list.items?.find(
      (item) => item.status === "captured" || (reconciliation && item.status === "refunded"),
    );
    if (!payment?.id) throw new Error("Razorpay order has no captured payment to refund.");
    return payment.id;
  }

  return {
    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const currency = input.currency.toUpperCase();
      // Razorpay amounts are in the smallest currency unit (paise for INR).
      const amount = input.amountCents;
      const notes: Record<string, string> = {
        tenantId: input.tenantId,
        paymentOrderId: input.paymentOrderId,
        ...input.metadata,
      };

      const order = await razorpayFetch<RazorpayOrder>(config, "/orders", {
        method: "POST",
        body: {
          amount,
          currency,
          // Razorpay receipt max length is 40; UUIDs are 36.
          receipt: input.paymentOrderId.slice(0, 40),
          notes,
        },
      });

      // `notes` stay on the server-created Razorpay order only. Handing them to Checkout.js would
      // copy browser-editable values onto the payment (audit finding C1).
      return {
        externalId: order.id,
        checkoutUrl: null,
        clientCheckout: {
          provider: "razorpay",
          keyId: config.keyId,
          orderId: order.id,
          amountCents: amount,
          currency,
          name: input.courseTitle,
          description: input.courseTitle,
        },
      };
    },

    async parseWebhook(args: { rawBody: string; signature: string }): Promise<ParsedWebhook> {
      try {
        verifyRazorpayWebhookSignature({
          rawBody: args.rawBody,
          signature: args.signature,
          webhookSecret: config.webhookSecret,
        });
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }

      let event: RazorpayWebhookPayload;
      try {
        event = JSON.parse(args.rawBody) as RazorpayWebhookPayload;
      } catch {
        return Promise.reject(new Error("Invalid Razorpay webhook JSON body."));
      }

      const rawType = typeof event.event === "string" ? event.event : "unknown";
      const payment = event.payload?.payment?.entity;
      const order = event.payload?.order?.entity;

      if (
        rawType === "refund.created" ||
        rawType === "refund.processed" ||
        rawType === "refund.failed" ||
        rawType === "refund.speed_changed"
      ) {
        if (!event.payload?.refund?.entity)
          throw new Error(`Razorpay ${rawType} webhook missing refund.`);
        const refund = normalizeRefund(event.payload.refund.entity);
        return {
          externalId: refund.externalId,
          paymentOrderId: null,
          status: "pending",
          rawType,
          refund,
        };
      }

      if (rawType === "payment.captured" || rawType === "order.paid") {
        const externalId =
          (typeof payment?.order_id === "string" && payment.order_id) ||
          (typeof order?.id === "string" && order.id) ||
          (typeof payment?.id === "string" && payment.id) ||
          "";
        if (!externalId) {
          return Promise.reject(new Error(`Razorpay ${rawType} webhook missing order/payment id.`));
        }
        return Promise.resolve({
          externalId,
          paymentOrderId: serverOrderNote(order),
          status: "paid",
          rawType,
          ...capturedAmount(payment, order),
        });
      }

      if (rawType === "payment.failed") {
        const externalId =
          (typeof payment?.order_id === "string" && payment.order_id) ||
          (typeof payment?.id === "string" && payment.id) ||
          "unknown";
        return Promise.resolve({
          externalId,
          paymentOrderId: serverOrderNote(order),
          status: "failed",
          rawType,
        });
      }

      return Promise.resolve({
        externalId:
          (typeof order?.id === "string" && order.id) ||
          (typeof payment?.id === "string" && payment.id) ||
          rawType,
        paymentOrderId: serverOrderNote(order),
        status: "pending",
        rawType,
      });
    },

    async refund(args: RefundInput): Promise<RefundResult> {
      if (
        !Number.isSafeInteger(args.amountCents) ||
        args.amountCents <= 0 ||
        !args.intentId ||
        !args.idempotencyKey
      ) {
        throw new Error(
          "Refund requires an exact positive amount and durable intent/idempotency key.",
        );
      }
      const paymentId = await resolvePayment(args.externalId);
      const refund = await razorpayFetch<RazorpayRefund>(
        config,
        `/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: "POST",
          // Supported by Razorpay's official CLI: cmd/refunds/create.go.
          headers: { "X-Refund-Idempotency": args.idempotencyKey },
          body: {
            amount: args.amountCents,
            receipt: args.intentId,
            notes: { atlasRefundIntentId: args.intentId, atlasPaymentExternalId: args.externalId },
          },
        },
      );

      if (refund.payment_id !== paymentId) {
        throw new Error("Razorpay refund does not match the requested payment.");
      }
      return normalizeRefund(refund, args.externalId);
    },

    async findRefund(args): Promise<RefundResult | null> {
      const paymentId = await resolvePayment(args.externalId, true);
      const matches = (refund: RazorpayRefund) =>
        refund.payment_id === paymentId &&
        (refund.notes?.["atlasRefundIntentId"] ?? refund.receipt) === args.intentId;
      const path = `/payments/${encodeURIComponent(paymentId)}/refunds`;
      if (args.refundId) {
        const refund = await razorpayFetch<RazorpayRefund>(
          config,
          `${path}/${encodeURIComponent(args.refundId)}`,
        );
        return matches(refund) ? normalizeRefund(refund, args.externalId) : null;
      }
      // Bounded read-only reconciliation; absence does not justify another POST.
      const list = await razorpayFetch<{ items?: RazorpayRefund[] }>(
        config,
        `${path}?count=100&skip=0`,
      );
      const refund = list.items?.find(matches);
      return refund ? normalizeRefund(refund, args.externalId) : null;
    },
  };
}
