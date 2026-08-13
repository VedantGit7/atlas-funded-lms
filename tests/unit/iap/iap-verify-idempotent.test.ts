import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000020";
const courseId = "018f0000-0000-7000-8000-000000000030";
const orderId = "018f0000-0000-7000-8000-000000000060";
const enrollmentId = "018f0000-0000-7000-8000-000000000050";

const {
  mockFindCourseById,
  mockFindPaymentOrderByExternalId,
  mockInsertPendingIapOrder,
  mockMarkOrderPaid,
  mockInsertEnrollment,
} = vi.hoisted(() => ({
  mockFindCourseById: vi.fn(),
  mockFindPaymentOrderByExternalId: vi.fn(),
  mockInsertPendingIapOrder: vi.fn(),
  mockMarkOrderPaid: vi.fn(),
  mockInsertEnrollment: vi.fn(),
}));

vi.mock("@atlas/domain/iap/iap.repository", () => ({
  iapRepository: {
    findCourseById: (...args: unknown[]) => mockFindCourseById(...args),
    findPaymentOrderByExternalId: (...args: unknown[]) => mockFindPaymentOrderByExternalId(...args),
    insertPendingIapOrder: (...args: unknown[]) => mockInsertPendingIapOrder(...args),
    markOrderPaid: (...args: unknown[]) => mockMarkOrderPaid(...args),
    insertEnrollment: (...args: unknown[]) => mockInsertEnrollment(...args),
  },
}));

import { verifyIapAndUnlock } from "@atlas/domain/iap/iap.service";
import { setIapVerifierOverride } from "@atlas/domain/iap/iap.registry";
import type { TenantTx } from "@atlas/db";

describe("verifyIapAndUnlock idempotency", () => {
  const tx = {} as TenantTx;
  const ctx = {
    tenantId,
    actorMembershipId,
    requestId: "req_iap_1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setIapVerifierOverride({
      ios: {
        platform: "ios",
        verify: async () => ({
          ok: true,
          environment: "sandbox",
          externalTransactionId: "apple_txn_idempotent",
          productId: "com.school.course",
          raw: { fixture: true },
        }),
      },
    });

    mockFindCourseById.mockResolvedValue({
      id: courseId,
      title: "IAP Course",
      status: "PUBLISHED",
      metadata_json: {
        tags: {
          studioStorePricing: {
            ios: {
              enabled: true,
              productId: "com.school.course",
              displayPriceLabel: "$9.99",
              priceTierHintCents: 999,
            },
            android: {
              enabled: false,
              productId: "",
              displayPriceLabel: "",
              priceTierHintCents: null,
            },
          },
        },
      },
    });
  });

  afterEach(() => {
    setIapVerifierOverride(null);
  });

  it("reuses an existing payment order by external_id and returns the same enrollment", async () => {
    mockFindPaymentOrderByExternalId.mockResolvedValue({
      id: orderId,
      membership_id: actorMembershipId,
      external_id: "apple_txn_idempotent",
      status: "paid",
      metadata_json: {
        kind: "course_iap",
        courseId,
        platform: "ios",
        productId: "com.school.course",
        environment: "sandbox",
      },
    });
    mockMarkOrderPaid.mockResolvedValue({ id: orderId, status: "paid" });
    mockInsertEnrollment
      .mockResolvedValueOnce({ id: enrollmentId, created: true })
      .mockResolvedValueOnce({ id: enrollmentId, created: false });

    const body = {
      courseId,
      platform: "ios" as const,
      productId: "com.school.course",
      receiptData: "sandbox:txn_idempotent",
    };

    const first = await verifyIapAndUnlock(tx, ctx, body);
    const second = await verifyIapAndUnlock(tx, ctx, body);

    expect(first.data.enrollmentId).toBe(enrollmentId);
    expect(second.data.enrollmentId).toBe(enrollmentId);
    expect(first.data.created).toBe(true);
    expect(second.data.created).toBe(false);
    expect(mockInsertPendingIapOrder).not.toHaveBeenCalled();
    expect(mockInsertEnrollment).toHaveBeenCalledTimes(2);
  });

  it("creates a pending→paid order then enrolls on first verify", async () => {
    mockFindPaymentOrderByExternalId.mockResolvedValue(null);
    mockInsertPendingIapOrder.mockResolvedValue({
      id: orderId,
      membership_id: actorMembershipId,
      external_id: "apple_txn_idempotent",
      status: "pending",
    });
    mockMarkOrderPaid.mockResolvedValue({ id: orderId, status: "paid" });
    mockInsertEnrollment.mockResolvedValue({ id: enrollmentId, created: true });

    const result = await verifyIapAndUnlock(tx, ctx, {
      courseId,
      platform: "ios",
      productId: "com.school.course",
      receiptData: "sandbox:txn_idempotent",
    });

    expect(result.data.paymentOrderId).toBe(orderId);
    expect(result.data.created).toBe(true);
    expect(mockInsertPendingIapOrder).toHaveBeenCalledOnce();
    expect(mockMarkOrderPaid).toHaveBeenCalledOnce();
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
  });
});
