import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  list: vi.fn(),
  session: vi.fn(),
  event: vi.fn(),
}));
vi.mock("../../../backend/packages/domain/node_modules/stripe/esm/stripe.esm.node.js", () => ({
  default: class {
    refunds = { create: sdk.create, retrieve: sdk.retrieve, list: sdk.list };
    checkout = { sessions: { retrieve: sdk.session } };
    webhooks = { constructEvent: sdk.event };
  },
}));

import { createStripePaymentProvider } from "../../../backend/packages/domain/src/payments/adapters/stripe.adapter";
import {
  computeRazorpayWebhookSignature,
  createRazorpayPaymentProvider,
} from "../../../backend/packages/domain/src/payments/adapters/razorpay.adapter";

const config = { keyId: "key_test", secretKey: "secret_test", webhookSecret: "webhook_test" };
const input = {
  externalId: "cs_test",
  amountCents: 2500,
  idempotencyKey: "refund-intent-1",
  intentId: "intent-1",
};
const stripeRefund = (overrides = {}) => ({
  id: "re_test",
  amount: 2500,
  currency: "usd",
  payment_intent: "pi_test",
  status: "pending",
  metadata: { atlasRefundIntentId: "intent-1", atlasPaymentExternalId: "cs_test" },
  ...overrides,
});
const razorpayRefund = (overrides = {}) => ({
  id: "rfnd_test",
  amount: 2500,
  currency: "INR",
  payment_id: "pay_test",
  status: "pending",
  receipt: "intent-1",
  notes: { atlasRefundIntentId: "intent-1", atlasPaymentExternalId: "order_test" },
  ...overrides,
});
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Stripe durable refunds", () => {
  it("sends exact amount, stable key and correlation metadata and preserves pending", async () => {
    sdk.session.mockResolvedValue({ payment_intent: { id: "pi_test" } });
    sdk.create.mockResolvedValue(stripeRefund());
    const result = await createStripePaymentProvider(config).refund(input);
    expect(sdk.create).toHaveBeenCalledWith(
      {
        payment_intent: "pi_test",
        amount: 2500,
        metadata: { atlasRefundIntentId: "intent-1", atlasPaymentExternalId: "cs_test" },
      },
      { idempotencyKey: "refund-intent-1", maxNetworkRetries: 0 },
    );
    expect(result).toEqual({
      refundId: "re_test",
      status: "pending",
      amountCents: 2500,
      currency: "USD",
      externalId: "cs_test",
      intentId: "intent-1",
    });
  });

  it.each([
    ["succeeded", "succeeded"],
    ["failed", "failed"],
    ["canceled", "failed"],
    ["requires_action", "pending"],
  ])("normalizes %s as %s", async (status, expected) => {
    sdk.create.mockResolvedValue(stripeRefund({ status }));
    expect(
      (await createStripePaymentProvider(config).refund({ ...input, externalId: "pi_test" }))
        .status,
    ).toBe(expected);
  });

  it("propagates an ambiguous POST failure without retrying", async () => {
    sdk.create.mockRejectedValue(new Error("connection reset"));
    await expect(
      createStripePaymentProvider(config).refund({ ...input, externalId: "pi_test" }),
    ).rejects.toThrow("connection reset");
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a refund response for another payment before attaching local identity", async () => {
    sdk.create.mockResolvedValue(stripeRefund({ payment_intent: "pi_other" }));
    await expect(
      createStripePaymentProvider(config).refund({ ...input, externalId: "pi_test" }),
    ).rejects.toThrow(/does not match/);
  });

  it("does not manufacture an intent on provider records without correlation metadata", async () => {
    sdk.event.mockReturnValue({
      type: "refund.updated",
      data: { object: stripeRefund({ metadata: {} }) },
    });
    const parsed = await createStripePaymentProvider(config).parseWebhook({
      rawBody: "body",
      signature: "sig",
    });
    expect(parsed.refund?.intentId).toBeNull();
    expect(parsed.refund?.externalId).toBe("pi_test");
  });

  it("bounds reconciliation to one page even when more records exist", async () => {
    sdk.list.mockResolvedValue({ data: [], has_more: true });
    expect(
      await createStripePaymentProvider(config).findRefund?.({
        externalId: "pi_test",
        intentId: "missing",
      }),
    ).toBeNull();
    expect(sdk.list).toHaveBeenCalledTimes(1);
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it("reconciles only matching payment and intent metadata from a bounded list", async () => {
    sdk.session.mockResolvedValue({ payment_intent: "pi_test" });
    sdk.list.mockResolvedValue({
      data: [
        stripeRefund({ id: "re_other", metadata: { atlasRefundIntentId: "other" } }),
        stripeRefund({ status: "succeeded" }),
      ],
      has_more: false,
    });
    const result = await createStripePaymentProvider(config).findRefund?.({
      externalId: "cs_test",
      intentId: "intent-1",
    });
    expect(result?.refundId).toBe("re_test");
    expect(result?.status).toBe("succeeded");
    expect(sdk.list).toHaveBeenCalledWith({ payment_intent: "pi_test", limit: 100 });
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it("does not accept a known refund belonging to a different payment", async () => {
    sdk.retrieve.mockResolvedValue(stripeRefund({ payment_intent: "pi_other" }));
    expect(
      await createStripePaymentProvider(config).findRefund?.({
        externalId: "pi_test",
        intentId: "intent-1",
        refundId: "re_test",
      }),
    ).toBeNull();
  });

  it.each(["refund.created", "refund.updated", "refund.failed", "charge.refund.updated"])(
    "parses verified %s independently of checkout status",
    async (type) => {
      sdk.event.mockReturnValue({
        type,
        data: {
          object: stripeRefund({ status: type === "refund.failed" ? "failed" : "succeeded" }),
        },
      });
      const parsed = await createStripePaymentProvider(config).parseWebhook({
        rawBody: "signed-body",
        signature: "signature",
      });
      expect(sdk.event).toHaveBeenCalledWith("signed-body", "signature", "webhook_test");
      expect(parsed.refund?.status).toBe(type === "refund.failed" ? "failed" : "succeeded");
      expect(parsed.externalId).toBe("cs_test");
      expect(parsed.status).toBe("pending");
    },
  );
});

describe("Razorpay durable refunds", () => {
  it("uses a captured payment, exact amount, stable header and intent receipt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          items: [
            { id: "pay_authorized", status: "authorized" },
            { id: "pay_test", status: "captured" },
          ],
        }),
      )
      .mockResolvedValueOnce(response(razorpayRefund()));
    vi.stubGlobal("fetch", fetchMock);
    const result = await createRazorpayPaymentProvider(config).refund({
      ...input,
      externalId: "order_test",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.razorpay.com/v1/payments/pay_test/refund",
    );
    const init = fetchMock.mock.calls[1]?.[1];
    expect(init.headers["X-Refund-Idempotency"]).toBe("refund-intent-1");
    expect(JSON.parse(init.body)).toEqual({
      amount: 2500,
      receipt: "intent-1",
      notes: { atlasRefundIntentId: "intent-1", atlasPaymentExternalId: "order_test" },
    });
    expect(result).toEqual({
      refundId: "rfnd_test",
      status: "pending",
      amountCents: 2500,
      currency: "INR",
      externalId: "order_test",
      intentId: "intent-1",
    });
  });

  it("refuses to refund an authorized-only order", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        response({ items: [{ id: "pay_test", status: "authorized" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createRazorpayPaymentProvider(config).refund({ ...input, externalId: "order_test" }),
    ).rejects.toThrow(/captured payment/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a timed out POST", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createRazorpayPaymentProvider(config).refund({ ...input, externalId: "pay_test" }),
    ).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a refund response for another payment before attaching local identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(razorpayRefund({ payment_id: "pay_other" }))),
    );
    await expect(
      createRazorpayPaymentProvider(config).refund({ ...input, externalId: "pay_test" }),
    ).rejects.toThrow(/does not match/);
  });

  it("reconciles a fully refunded order using its refunded payment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [{ id: "pay_test", status: "refunded" }] }))
      .mockResolvedValueOnce(response(razorpayRefund({ status: "processed" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      (
        await createRazorpayPaymentProvider(config).findRefund?.({
          externalId: "order_test",
          intentId: "intent-1",
          refundId: "rfnd_test",
        })
      )?.status,
    ).toBe("succeeded");
    expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });

  it("finds intent metadata with read-only bounded payment refunds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        items: [
          razorpayRefund({ id: "rfnd_other", receipt: "other", notes: {} }),
          razorpayRefund({ status: "processed" }),
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const found = await createRazorpayPaymentProvider(config).findRefund?.({
      externalId: "pay_test",
      intentId: "intent-1",
    });
    expect(found?.refundId).toBe("rfnd_test");
    expect(found?.status).toBe("succeeded");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/payments/pay_test/refunds?count=100&skip=0",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects a mismatched known refund", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(razorpayRefund({ payment_id: "pay_other" }))),
    );
    expect(
      await createRazorpayPaymentProvider(config).findRefund?.({
        externalId: "pay_test",
        intentId: "intent-1",
        refundId: "rfnd_test",
      }),
    ).toBeNull();
  });

  it.each([
    ["refund.created", "pending", "pending"],
    ["refund.processed", "processed", "succeeded"],
    ["refund.failed", "failed", "failed"],
  ])("parses signed %s", async (event, status, expected) => {
    const rawBody = JSON.stringify({
      event,
      payload: { refund: { entity: razorpayRefund({ status }) } },
    });
    const parsed = await createRazorpayPaymentProvider(config).parseWebhook({
      rawBody,
      signature: computeRazorpayWebhookSignature(rawBody, config.webhookSecret),
    });
    expect(parsed.refund?.status).toBe(expected);
    expect(parsed.refund?.intentId).toBe("intent-1");
    expect(parsed.externalId).toBe("order_test");
    expect(parsed.status).toBe("pending");
  });

  it("rejects an unsigned refund webhook", async () => {
    await expect(
      createRazorpayPaymentProvider(config).parseWebhook({
        rawBody: JSON.stringify({
          event: "refund.processed",
          payload: { refund: { entity: razorpayRefund() } },
        }),
        signature: "invalid",
      }),
    ).rejects.toThrow("Invalid Razorpay webhook signature");
  });
});

describe.each([
  ["Stripe", createStripePaymentProvider],
  ["Razorpay", createRazorpayPaymentProvider],
] as const)("%s refund validation", (_name, factory) => {
  it.each([0, -1, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe amount %s before contacting the provider",
    async (amountCents) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(factory(config).refund({ ...input, amountCents })).rejects.toThrow(
        /exact positive amount/,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(sdk.create).not.toHaveBeenCalled();
    },
  );
});
