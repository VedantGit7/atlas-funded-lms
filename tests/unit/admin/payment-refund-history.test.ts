import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import { PaymentRefundHistory } from "../../../frontend/apps/web/src/features/admin/reports/PaymentRefundHistory";
import type { PaymentTransactionDetail } from "../../../frontend/apps/web/src/features/admin/reports/admin-payments-roster-api";

describe("refund history", () => {
  it("shows confirmation state, fulfillment and provider reference for mixed history", () => {
    const base = {
      amountCents: 2500,
      reason: "duplicate",
      note: null,
      mode: "partial" as const,
      revokeAccess: false,
      notifyLearner: false,
      accessRevoked: false,
      notifyQueued: false,
      actorMembershipId: null,
      createdAt: "2026-09-19T10:00:00Z",
    };
    const refunds: PaymentTransactionDetail["refunds"] = [
      {
        ...base,
        id: "1",
        status: "pending",
        fulfillment: "gateway",
        gatewayRefundId: "re_pending_123",
      },
      { ...base, id: "2", status: "succeeded", fulfillment: "gateway" },
      { ...base, id: "3", status: "failed", fulfillment: "gateway" },
      { ...base, id: "4", status: "manual_adjustment", fulfillment: "manual_adjustment" },
      { ...base, id: "5", status: "legacy_recorded", fulfillment: "legacy_recorded" },
    ];
    const html = renderToStaticMarkup(
      createElement(PaymentRefundHistory, { refunds, currency: "USD" }),
    );
    expect(html).toContain("awaiting gateway confirmation");
    expect(html).toContain("Refund confirmed by the gateway");
    expect(html).toContain("Refund failed — no refund confirmed");
    expect(html).toContain("Manual adjustment recorded — no money sent");
    expect(html).toContain("Legacy refund record — gateway confirmation unavailable");
    expect(html).toContain("Gateway refund ID: re_pending_123");
    expect(html).toContain("Fulfillment: gateway");
    expect(html).not.toContain("Process the matching reverse");
  });
});
