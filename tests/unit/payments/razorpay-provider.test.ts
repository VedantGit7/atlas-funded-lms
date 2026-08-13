import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDecryptPaymentSecret } = vi.hoisted(() => ({
  mockDecryptPaymentSecret: vi.fn(),
}));

vi.mock("@atlas/domain-config/payment-secret-crypto", () => ({
  decryptPaymentSecret: (...args: unknown[]) => mockDecryptPaymentSecret(...args),
}));

import {
  computeRazorpayWebhookSignature,
  createRazorpayPaymentProvider,
} from "../../../backend/packages/domain/src/payments/adapters/razorpay.adapter";
import {
  resolvePaymentProvider,
  UnsupportedPaymentGatewayError,
} from "../../../backend/packages/domain/src/payments/payment-provider.registry";

describe("Razorpay PaymentProvider adapter", () => {
  it("computes HMAC SHA256 webhook signatures", () => {
    const body = '{"event":"payment.captured"}';
    const secret = "whsec_test";
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    expect(computeRazorpayWebhookSignature(body, secret)).toBe(expected);
  });

  it("parseWebhook maps payment.captured to paid when signature is valid", async () => {
    const webhookSecret = "whsec_rzp";
    const provider = createRazorpayPaymentProvider({
      keyId: "rzp_test_key",
      secretKey: "rzp_test_secret",
      webhookSecret,
    });
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_123",
            order_id: "order_abc",
            status: "captured",
            notes: { paymentOrderId: "018f0000-0000-7000-8000-000000000099" },
          },
        },
      },
    });
    const signature = computeRazorpayWebhookSignature(rawBody, webhookSecret);
    const parsed = await provider.parseWebhook({ rawBody, signature });
    expect(parsed.status).toBe("paid");
    expect(parsed.externalId).toBe("order_abc");
    expect(parsed.paymentOrderId).toBe("018f0000-0000-7000-8000-000000000099");
    expect(parsed.rawType).toBe("payment.captured");
  });

  it("parseWebhook rejects invalid signatures", async () => {
    const provider = createRazorpayPaymentProvider({
      keyId: "rzp_test_key",
      secretKey: "rzp_test_secret",
      webhookSecret: "whsec_rzp",
    });
    await expect(
      provider.parseWebhook({
        rawBody: "{}",
        signature: "deadbeef",
      }),
    ).rejects.toThrow(/Invalid Razorpay webhook signature/);
  });

  it("parseWebhook maps order.paid to paid", async () => {
    const webhookSecret = "whsec_rzp";
    const provider = createRazorpayPaymentProvider({
      keyId: "rzp_test_key",
      secretKey: "rzp_test_secret",
      webhookSecret,
    });
    const rawBody = JSON.stringify({
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: "order_xyz",
            notes: { paymentOrderId: "po-1" },
          },
        },
      },
    });
    const signature = computeRazorpayWebhookSignature(rawBody, webhookSecret);
    const parsed = await provider.parseWebhook({ rawBody, signature });
    expect(parsed.status).toBe("paid");
    expect(parsed.externalId).toBe("order_xyz");
  });
});

describe("resolvePaymentProvider razorpay", () => {
  const prevRazorpay = process.env["RAZORPAY_WEBHOOK_SECRET"];
  const prevStripe = process.env["STRIPE_WEBHOOK_SECRET"];

  beforeEach(() => {
    mockDecryptPaymentSecret.mockReset();
    mockDecryptPaymentSecret.mockReturnValue("rzp_live_secret");
    process.env["RAZORPAY_WEBHOOK_SECRET"] = "rzp_whsec";
    delete process.env["STRIPE_WEBHOOK_SECRET"];
  });

  afterEach(() => {
    if (prevRazorpay === undefined) delete process.env["RAZORPAY_WEBHOOK_SECRET"];
    else process.env["RAZORPAY_WEBHOOK_SECRET"] = prevRazorpay;
    if (prevStripe === undefined) delete process.env["STRIPE_WEBHOOK_SECRET"];
    else process.env["STRIPE_WEBHOOK_SECRET"] = prevStripe;
  });

  it("resolves a razorpay gateway with Key ID + webhook secret", async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [
        {
          id: "gw-rzp-1",
          gateway_key: "razorpay",
          publishable_key: "rzp_test_keyid",
          secret_ciphertext: "cipher",
          is_default: true,
          is_published: true,
          is_configured: true,
        },
      ]),
    };

    const resolved = await resolvePaymentProvider(tx as never, {
      gatewayKey: "razorpay",
      requireWebhookSecret: true,
    });

    expect(resolved.gatewayKey).toBe("razorpay");
    expect(resolved.gatewayId).toBe("gw-rzp-1");
    expect(resolved.provider.createCheckout).toBeTypeOf("function");
    expect(resolved.provider.parseWebhook).toBeTypeOf("function");
    expect(mockDecryptPaymentSecret).toHaveBeenCalledWith("cipher");
  });

  it("still rejects unknown gateways", async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [
        {
          id: "gw-x",
          gateway_key: "paypal",
          publishable_key: "pk",
          secret_ciphertext: "cipher",
          is_default: true,
          is_published: true,
          is_configured: true,
        },
      ]),
    };
    await expect(
      resolvePaymentProvider(tx as never, { gatewayKey: "paypal" }),
    ).rejects.toBeInstanceOf(UnsupportedPaymentGatewayError);
  });
});
