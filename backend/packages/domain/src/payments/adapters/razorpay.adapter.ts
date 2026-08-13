import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
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
  notes?: Record<string, string> | null;
  amount?: number;
};

type RazorpayRefund = {
  id: string;
};

type RazorpayPaymentsList = {
  items?: RazorpayPayment[];
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: RazorpayOrder & { notes?: Record<string, string> | null } };
  };
};

function basicAuthHeader(keyId: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${keyId}:${secretKey}`).toString("base64")}`;
}

async function razorpayFetch<T>(
  config: RazorpayAdapterConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const method = init?.method ?? "GET";
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: basicAuthHeader(config.keyId, config.secretKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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

/**
 * Razorpay HTTP API is confined to this adapter. Business logic must depend only on PaymentProvider.
 * Checkout uses Orders API; the browser opens Checkout.js with the returned clientCheckout payload.
 */
export function createRazorpayPaymentProvider(config: RazorpayAdapterConfig): PaymentProvider {
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
          notes,
        },
      };
    },

    parseWebhook(args: { rawBody: string; signature: string }): Promise<ParsedWebhook> {
      verifyRazorpayWebhookSignature({
        rawBody: args.rawBody,
        signature: args.signature,
        webhookSecret: config.webhookSecret,
      });

      let event: RazorpayWebhookPayload;
      try {
        event = JSON.parse(args.rawBody) as RazorpayWebhookPayload;
      } catch {
        throw new Error("Invalid Razorpay webhook JSON body.");
      }

      const rawType = typeof event.event === "string" ? event.event : "unknown";
      const payment = event.payload?.payment?.entity;
      const order = event.payload?.order?.entity;

      if (rawType === "payment.captured" || rawType === "order.paid") {
        const externalId =
          (typeof payment?.order_id === "string" && payment.order_id) ||
          (typeof order?.id === "string" && order.id) ||
          (typeof payment?.id === "string" && payment.id) ||
          "";
        if (!externalId) {
          throw new Error(`Razorpay ${rawType} webhook missing order/payment id.`);
        }
        const paymentOrderId =
          payment?.notes?.["paymentOrderId"] ?? order?.notes?.["paymentOrderId"] ?? null;
        return Promise.resolve({
          externalId,
          paymentOrderId,
          status: "paid",
          rawType,
        });
      }

      if (rawType === "payment.failed") {
        const externalId =
          (typeof payment?.order_id === "string" && payment.order_id) ||
          (typeof payment?.id === "string" && payment.id) ||
          "unknown";
        return Promise.resolve({
          externalId,
          paymentOrderId: payment?.notes?.["paymentOrderId"] ?? null,
          status: "failed",
          rawType,
        });
      }

      return Promise.resolve({
        externalId:
          (typeof order?.id === "string" && order.id) ||
          (typeof payment?.id === "string" && payment.id) ||
          rawType,
        paymentOrderId:
          payment?.notes?.["paymentOrderId"] ?? order?.notes?.["paymentOrderId"] ?? null,
        status: "pending",
        rawType,
      });
    },

    async refund(args: { externalId: string; amountCents?: number }) {
      let paymentId = args.externalId;

      if (args.externalId.startsWith("order_")) {
        const list = await razorpayFetch<RazorpayPaymentsList>(
          config,
          `/orders/${encodeURIComponent(args.externalId)}/payments`,
        );
        const captured =
          list.items?.find((item) => item.status === "captured") ??
          list.items?.find((item) => item.status === "authorized") ??
          list.items?.[0];
        if (!captured?.id) {
          throw new Error("Razorpay order has no payment to refund.");
        }
        paymentId = captured.id;
      }

      const refund = await razorpayFetch<RazorpayRefund>(
        config,
        `/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: "POST",
          body: {
            ...(args.amountCents != null ? { amount: args.amountCents } : {}),
          },
        },
      );

      return { refundId: refund.id };
    },
  };
}
