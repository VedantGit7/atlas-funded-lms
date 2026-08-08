import { describe, expect, it } from "vitest";
import {
  createPaymentOrderBodySchema,
  listPaymentOrdersQuerySchema,
  stripeWebhookBodySchema,
} from "@atlas/domain/payments/payments.dto";
import {
  captureDeviceSessionBodySchema,
  listDeviceSessionsQuerySchema,
} from "@atlas/domain/devices/devices.dto";

describe("payments dto validation", () => {
  it("parses create payment order body with defaults", () => {
    const body = createPaymentOrderBodySchema.parse({
      amountCents: 9900,
    });

    expect(body.currency).toBe("USD");
    expect(body.status).toBe("pending");
    expect(body.amountCents).toBe(9900);
  });

  it("rejects client tenant fields on create payment order", () => {
    expect(() =>
      createPaymentOrderBodySchema.parse({
        amountCents: 100,
        tenant_id: "bad",
      }),
    ).toThrow();
  });

  it("parses list query with status filter", () => {
    expect(listPaymentOrdersQuerySchema.parse({ status: "paid", limit: 10 }).status).toBe("paid");
  });

  it("parses stripe webhook stub body", () => {
    const body = stripeWebhookBodySchema.parse({
      externalId: "pi_123",
      status: "paid",
    });

    expect(body.externalId).toBe("pi_123");
  });
});

describe("devices dto validation", () => {
  it("parses capture device session body", () => {
    const body = captureDeviceSessionBodySchema.parse({
      platform: "web",
      userAgent: "Mozilla/5.0",
    });

    expect(body.platform).toBe("web");
  });

  it("rejects tenantId injection on list query", () => {
    expect(() => listDeviceSessionsQuerySchema.parse({ tenantId: "bad" })).toThrow();
  });
});
