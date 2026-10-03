import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import type * as RefundRepositoryModule from "../../../backend/packages/domain/src/payments/refund-intents.repository";
import type * as RefundWorkflowModule from "../../../backend/packages/domain/src/payments/refund-workflow";
import type {
  RefundIntent,
  RefundState,
} from "../../../backend/packages/domain/src/payments/refund-intents.repository";
import type { PaymentTransactionDetailRow } from "../../../backend/packages/domain/src/reports/payments-roster.repository";

const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  find: vi.fn(),
  list: vi.fn(),
  batch: vi.fn(),
  reserve: vi.fn(),
  resolve: vi.fn(),
  refund: vi.fn(),
  applyLedger: vi.fn(),
  detail: vi.fn(),
  revoke: vi.fn(),
  countLedger: vi.fn(),
  listLedger: vi.fn(),
  summary: vi.fn(),
}));

vi.mock(
  "../../../backend/packages/domain/src/payments/refund-intents.repository",
  async (original) => ({
    ...(await original<typeof RefundRepositoryModule>()),
    lockRefundOrder: mocks.lock,
    findRefundRequest: mocks.find,
    listRefundIntents: mocks.list,
    listRefundIntentsForOrders: mocks.batch,
    reserveRefund: mocks.reserve,
  }),
);
vi.mock("../../../backend/packages/domain/src/payments/payment-provider.registry", () => ({
  resolvePaymentProvider: mocks.resolve,
}));
vi.mock("../../../backend/packages/domain/src/payments/refund-workflow", async (original) => ({
  ...(await original<typeof RefundWorkflowModule>()),
  applyRefundLedger: mocks.applyLedger,
}));
vi.mock("../../../backend/packages/domain/src/reports/payments-roster.repository", () => ({
  paymentsRosterRepository: {
    findTransactionDetailByOrderId: mocks.detail,
    revokeCourseEnrollment: mocks.revoke,
    countRefundLedger: mocks.countLedger,
    listRefundLedger: mocks.listLedger,
    getRefundsQueueSummary: mocks.summary,
  },
}));

import {
  getPaymentTransactionDetail,
  listPaymentRefunds,
  refundPaymentTransaction,
} from "../../../backend/packages/domain/src/reports/payments-roster.service";
import {
  paymentRefundsQuerySchema,
  refundPaymentTransactionBodySchema,
} from "../../../backend/packages/domain/src/reports/payments-roster.dto";
import { refundFingerprint } from "../../../backend/packages/domain/src/payments/refund-intents.repository";
import { refundPublicRecord } from "../../../backend/packages/domain/src/payments/refund-workflow";

const ids = {
  order: "10000000-0000-4000-8000-000000000001",
  tenant: "10000000-0000-4000-8000-000000000002",
  actor: "10000000-0000-4000-8000-000000000003",
  learner: "10000000-0000-4000-8000-000000000004",
  gateway: "10000000-0000-4000-8000-000000000005",
  intent: "10000000-0000-4000-8000-000000000006",
  request: "10000000-0000-4000-8000-000000000007",
  course: "10000000-0000-4000-8000-000000000008",
};
const now = new Date("2026-09-20T00:00:00Z");
const ctx = { tenantId: ids.tenant, actorMembershipId: ids.actor, requestId: "http-request" };
const txMock = { $queryRaw: vi.fn(), $executeRaw: vi.fn() };
const tx = txMock as unknown as TenantTx;
const body = {
  refundRequestId: ids.request,
  mode: "partial",
  amountCents: 2500,
  reason: "duplicate",
  note: "Duplicate purchase verified",
  revokeAccess: true,
  notifyLearner: false,
};
let row: PaymentTransactionDetailRow;
let intents: RefundIntent[];

function intent(overrides: Partial<RefundIntent> = {}): RefundIntent {
  return {
    id: ids.intent,
    tenant_id: ids.tenant,
    order_id: ids.order,
    request_key: ids.request,
    request_fingerprint: refundFingerprint(
      refundPaymentTransactionBodySchema.parse(body),
      ids.order,
      ids.actor,
    ),
    amount_cents: 2500,
    currency: "USD",
    gateway_key: "stripe",
    gateway_id: ids.gateway,
    external_id: "cs_original",
    status: "requested",
    provider_refund_id: null,
    payload_json: {
      mode: "partial",
      reason: "duplicate",
      note: body.note,
      revokeAccess: true,
      notifyLearner: false,
      actorMembershipId: ids.actor,
      membershipId: ids.learner,
      courseId: ids.course,
      refundMethod: "gateway",
    },
    lease_token: null,
    lease_until: null,
    attempts: 0,
    next_attempt_at: now,
    created_at: now,
    updated_at: now,
    last_error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  row = {
    id: ids.order,
    membership_id: ids.learner,
    learner_name: "Learner",
    email: "learner@example.test",
    product_title: "Course",
    product_type: "course",
    gateway_key: "stripe",
    coupon_amount_cents: 0,
    amount_cents: 10000,
    tax_amount_cents: 0,
    currency: "USD",
    status: "paid",
    invoice_number: null,
    external_id: "cs_original",
    billing_name: "Learner",
    metadata_json: { courseId: ids.course },
    paid_at: now,
    created_at: now,
    updated_at: now,
  };
  intents = [];
  mocks.lock.mockResolvedValue(true);
  mocks.detail.mockImplementation(async () => row);
  mocks.list.mockImplementation(async () => [...intents]);
  mocks.find.mockImplementation(
    async (_tx, key: string) => intents.find((item) => item.request_key === key) ?? null,
  );
  mocks.resolve.mockResolvedValue({
    gatewayKey: "stripe",
    gatewayId: ids.gateway,
    provider: { refund: mocks.refund },
  });
  mocks.reserve.mockImplementation(
    async (
      _tx,
      input: {
        fingerprint: string;
        amountCents: number;
        gatewayId: string | null;
        payload: RefundIntent["payload_json"];
      },
    ) => {
      const saved = intent({
        request_fingerprint: input.fingerprint,
        amount_cents: input.amountCents,
        gateway_id: input.gatewayId,
        payload_json: input.payload,
        status:
          input.payload.refundMethod === "manual_adjustment" ? "manual_adjustment" : "requested",
      });
      intents.push(saved);
      return saved;
    },
  );
});

describe("refund request service", () => {
  it("rejects a fallback gateway key even when it supplies a valid gateway ID", async () => {
    mocks.resolve.mockResolvedValue({
      gatewayKey: "razorpay",
      gatewayId: ids.gateway,
      provider: { refund: mocks.refund },
    });
    await expect(refundPaymentTransaction(tx, ctx, ids.order, body)).rejects.toThrow(
      "original payment gateway is unavailable",
    );
    expect(mocks.resolve).toHaveBeenCalledWith(tx, { gatewayKey: "stripe" });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.applyLedger).not.toHaveBeenCalled();
  });

  it("reserves the requested amount without moving money or changing access", async () => {
    const result = await refundPaymentTransaction(tx, ctx, ids.order, body);
    expect(mocks.reserve).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId: ids.tenant,
        orderId: ids.order,
        requestKey: ids.request,
        amountCents: 2500,
        availableCents: 10000,
        gatewayKey: "stripe",
        gatewayId: ids.gateway,
        externalId: "cs_original",
        payload: expect.objectContaining({
          courseId: ids.course,
          revokeAccess: true,
          refundMethod: "gateway",
        }),
      }),
    );
    expect(result.data).toMatchObject({
      status: "paid",
      refundedAmountCents: 0,
      refundableAmountCents: 7500,
      accessRevoked: false,
      refund: { id: ids.intent, status: "requested", fulfillment: "gateway" },
    });
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.applyLedger).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(txMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("replays the same permanent request without reserving or resolving a gateway twice", async () => {
    const first = await refundPaymentTransaction(tx, ctx, ids.order, body);
    const replay = await refundPaymentTransaction(tx, ctx, ids.order, body);
    expect(replay).toEqual(first);
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
    expect(mocks.resolve).toHaveBeenCalledTimes(1);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it.each([{ amountCents: 2600 }, { note: "Changed reason context" }, { revokeAccess: false }])(
    "rejects a reused request with changed payload %j",
    async (changes) => {
      await refundPaymentTransaction(tx, ctx, ids.order, body);
      await expect(
        refundPaymentTransaction(tx, ctx, ids.order, { ...body, ...changes }),
      ).rejects.toThrow("different refund details");
      expect(mocks.reserve).toHaveBeenCalledTimes(1);
      expect(mocks.resolve).toHaveBeenCalledTimes(1);
    },
  );

  it("uses only the unreserved balance for a full refund", async () => {
    intents = [
      intent({
        request_key: "10000000-0000-4000-8000-000000000009",
        status: "pending",
        amount_cents: 3000,
      }),
    ];
    await refundPaymentTransaction(tx, ctx, ids.order, { ...body, mode: "full" });
    expect(mocks.reserve).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amountCents: 7000, availableCents: 7000 }),
    );
  });

  it("requires an explicit manual reference before reserving anything", async () => {
    await expect(
      refundPaymentTransaction(tx, ctx, ids.order, { ...body, refundMethod: "manual_adjustment" }),
    ).rejects.toThrow("Manual adjustments require a reference");
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("records a manual adjustment with its reference and never contacts a gateway", async () => {
    mocks.applyLedger.mockImplementation(async (_tx, saved: RefundIntent) => {
      row = {
        ...row,
        metadata_json: { courseId: ids.course, refunds: [refundPublicRecord(saved)] },
      };
      return false;
    });
    const result = await refundPaymentTransaction(tx, ctx, ids.order, {
      ...body,
      refundMethod: "manual_adjustment",
      manualReference: "BANK-TRANSFER-42",
      revokeAccess: false,
    });
    expect(mocks.reserve).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        gatewayId: null,
        payload: expect.objectContaining({
          refundMethod: "manual_adjustment",
          manualReference: "BANK-TRANSFER-42",
        }),
      }),
    );
    expect(mocks.applyLedger).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({
      refundedAmountCents: 2500,
      refundableAmountCents: 7500,
      refund: { status: "manual_adjustment", fulfillment: "manual_adjustment" },
    });
    expect(result.data.gatewayNote).toContain("No money was sent");
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe("refund reporting services", () => {
  it("deducts unresolved reservations without counting failed refunds or settled ledger records twice", async () => {
    const succeeded = intent({ status: "succeeded", amount_cents: 1000 });
    row.metadata_json = { refunds: [refundPublicRecord(succeeded)] };
    intents = [
      succeeded,
      intent({ id: ids.request, status: "pending", amount_cents: 2000 }),
      intent({ id: ids.course, status: "reconciliation_required", amount_cents: 500 }),
      intent({ id: ids.gateway, status: "failed", amount_cents: 3000 }),
    ];
    const result = await getPaymentTransactionDetail(tx, ctx, ids.order);
    expect(result.data).toMatchObject({
      refundedAmountCents: 1000,
      reservedRefundAmountCents: 2500,
      refundableAmountCents: 6500,
      canRefund: true,
    });
    expect(result.data.refunds).toHaveLength(4);
  });

  it("loads intents once for the page and exposes their states and reserved balances", async () => {
    const states: RefundState[] = [
      "requested",
      "processing",
      "pending",
      "reconciliation_required",
      "failed",
      "succeeded",
      "manual_adjustment",
    ];
    const pageIntents = states.map((status, index) =>
      intent({
        id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        order_id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        status,
        provider_refund_id: status === "succeeded" ? "re_confirmed" : null,
      }),
    );
    const ledgerRows = pageIntents.map((item, index) => ({
      ...row,
      id: item.order_id,
      metadata_json: {},
      refunded_amount_cents: index >= 5 ? 2500 : 0,
      reserved_amount_cents: index < 4 ? 2500 : 0,
      refundable_amount_cents: index < 4 || index >= 5 ? 7500 : 10000,
    }));
    mocks.countLedger.mockResolvedValue(7);
    mocks.listLedger.mockResolvedValue(ledgerRows);
    mocks.batch.mockResolvedValue(pageIntents);
    mocks.summary.mockResolvedValue({
      refundable_count: 7,
      partial_count: 2,
      refunded_count: 0,
      refundable_amount_cents: 55000,
      refunded_amount_cents: 5000,
      currency: "usd",
    });
    const result = await listPaymentRefunds(
      tx,
      ctx,
      paymentRefundsQuerySchema.parse({ queue: "all" }),
    );
    expect(mocks.batch).toHaveBeenCalledExactlyOnceWith(
      tx,
      ledgerRows.map((item) => item.id),
    );
    expect(mocks.list).not.toHaveBeenCalled();
    expect(result.data.items.map((item) => item.latestRefund?.status)).toEqual(states);
    expect(result.data.items.map((item) => item.reservedRefundAmountCents)).toEqual([
      2500, 2500, 2500, 2500, 0, 0, 0,
    ]);
    expect(result.data.items[5]?.latestRefund?.gatewayRefundId).toBe("re_confirmed");
    expect(result.data.items.every((item) => item.refundCount === 1)).toBe(true);
    expect(result.data.summary.currency).toBe("USD");
  });
});
