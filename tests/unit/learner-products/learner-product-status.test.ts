import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRepository, mockAuditWrite } = vi.hoisted(() => ({
  mockRepository: {
    listProductStatuses: vi.fn(),
    updateProductStatuses: vi.fn(),
  },
  mockAuditWrite: vi.fn(),
}));

vi.mock(
  "../../../backend/packages/domain/src/learner-products/learner-products.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      learnerProductsRepository: mockRepository,
    };
  },
);

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: (...args: unknown[]) => mockAuditWrite(...args) },
  writeAuditEntry: (...args: unknown[]) => mockAuditWrite(...args),
}));

const { updateLearnerProductStatuses } =
  await import("../../../backend/packages/domain/src/learner-products/learner-products.service");

const ctx = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  actorMembershipId: "22222222-2222-4222-8222-222222222222",
  requestId: "req-1",
};

const bundleA = "33333333-3333-4333-8333-333333333333";
const bundleB = "44444444-4444-4444-8444-444444444444";
const goneId = "55555555-5555-4555-8555-555555555555";

// The service only ever hands `tx` to the repository and the audit writer, both
// of which are mocked here.
const tx = {} as never;

function statusRow(id: string, slug: string, status: string) {
  return { id, slug, status };
}

describe("updateLearnerProductStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves the whole selection in one call and reports the previous state", async () => {
    mockRepository.listProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "DRAFT"),
      statusRow(bundleB, "starter-pack", "ARCHIVED"),
    ]);
    mockRepository.updateProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "PUBLISHED"),
      statusRow(bundleB, "starter-pack", "PUBLISHED"),
    ]);

    const result = await updateLearnerProductStatuses(tx, ctx, {
      productKind: "bundle",
      productIds: [bundleA, bundleB],
      status: "PUBLISHED",
    });

    expect(mockRepository.updateProductStatuses).toHaveBeenCalledTimes(1);
    expect(mockRepository.updateProductStatuses).toHaveBeenCalledWith(
      tx,
      "bundles",
      [bundleA, bundleB],
      "PUBLISHED",
    );
    expect(result.data.updated).toEqual([
      { id: bundleA, slug: "trader-bundle", previousStatus: "DRAFT", status: "PUBLISHED" },
      { id: bundleB, slug: "starter-pack", previousStatus: "ARCHIVED", status: "PUBLISHED" },
    ]);
    expect(result.data.missingIds).toEqual([]);
  });

  it("routes each product kind to its own table and audit action", async () => {
    const kinds = [
      ["mock_test", "mock_tests", "learner_product.mock_test.status_changed", "mock_test"],
      ["test_series", "test_series", "learner_product.test_series.status_changed", "test_series"],
      ["bundle", "bundles", "learner_product.bundle.status_changed", "bundle"],
      [
        "subscription_plan",
        "learner_subscription_plans",
        "learner_product.subscription_plan.status_changed",
        "learner_subscription_plan",
      ],
    ] as const;

    for (const [kind, table, action, target] of kinds) {
      vi.clearAllMocks();
      mockRepository.listProductStatuses.mockResolvedValue([statusRow(bundleA, "slug-a", "DRAFT")]);
      mockRepository.updateProductStatuses.mockResolvedValue([
        statusRow(bundleA, "slug-a", "PUBLISHED"),
      ]);

      await updateLearnerProductStatuses(tx, ctx, {
        productKind: kind,
        productIds: [bundleA],
        status: "PUBLISHED",
      });

      expect(mockRepository.updateProductStatuses).toHaveBeenCalledWith(
        tx,
        table,
        [bundleA],
        "PUBLISHED",
      );
      const entry = mockAuditWrite.mock.calls[0]?.[2] as {
        action: string;
        target: { type: string };
      };
      expect(entry.action).toBe(action);
      expect(entry.target.type).toBe(target);
    }
  });

  it("writes one audit entry per product, carrying before and after", async () => {
    mockRepository.listProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "DRAFT"),
      statusRow(bundleB, "starter-pack", "PUBLISHED"),
    ]);
    mockRepository.updateProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "ARCHIVED"),
      statusRow(bundleB, "starter-pack", "ARCHIVED"),
    ]);

    await updateLearnerProductStatuses(tx, ctx, {
      productKind: "bundle",
      productIds: [bundleA, bundleB],
      status: "ARCHIVED",
    });

    expect(mockAuditWrite).toHaveBeenCalledTimes(2);

    const [, actor, first] = mockAuditWrite.mock.calls[0] as [
      unknown,
      { tenantId: string; actorMembershipId: string; requestId: string },
      {
        action: string;
        target: { type: string; id: string };
        before: { status: string };
        after: { status: string };
        metadata: Record<string, unknown>;
      },
    ];
    expect(actor).toMatchObject({
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    });
    expect(first.target).toEqual({ type: "bundle", id: bundleA });
    expect(first.before).toEqual({ status: "DRAFT" });
    expect(first.after).toEqual({ status: "ARCHIVED" });
    expect(first.metadata).toEqual({ slug: "trader-bundle" });

    const second = mockAuditWrite.mock.calls[1]?.[2] as { before: { status: string } };
    expect(second.before).toEqual({ status: "PUBLISHED" });
  });

  it("reports ids this tenant cannot see instead of failing the batch", async () => {
    // RLS hides other tenants' rows from the read, so a foreign id simply does
    // not come back — the same shape as a row deleted while the page sat open.
    mockRepository.listProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "DRAFT"),
    ]);
    mockRepository.updateProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "PUBLISHED"),
    ]);

    const result = await updateLearnerProductStatuses(tx, ctx, {
      productKind: "bundle",
      productIds: [bundleA, goneId],
      status: "PUBLISHED",
    });

    expect(mockRepository.updateProductStatuses).toHaveBeenCalledWith(
      tx,
      "bundles",
      [bundleA],
      "PUBLISHED",
    );
    expect(result.data.updated).toHaveLength(1);
    expect(result.data.missingIds).toEqual([goneId]);
    expect(mockAuditWrite).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates repeated ids so one row cannot produce two audit entries", async () => {
    mockRepository.listProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "DRAFT"),
    ]);
    mockRepository.updateProductStatuses.mockResolvedValue([
      statusRow(bundleA, "trader-bundle", "PUBLISHED"),
    ]);

    await updateLearnerProductStatuses(tx, ctx, {
      productKind: "bundle",
      productIds: [bundleA, bundleA, bundleA],
      status: "PUBLISHED",
    });

    expect(mockRepository.listProductStatuses).toHaveBeenCalledWith(tx, "bundles", [bundleA]);
    expect(mockAuditWrite).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed request before touching the database", async () => {
    const badBodies = [
      { productKind: "bundle", productIds: [bundleA], status: "LIVE" },
      { productKind: "course", productIds: [bundleA], status: "PUBLISHED" },
      { productKind: "bundle", productIds: [], status: "PUBLISHED" },
      { productKind: "bundle", productIds: ["not-a-uuid"], status: "PUBLISHED" },
      { productKind: "bundle", productIds: [bundleA], status: "PUBLISHED", slug: "renamed" },
    ];

    for (const body of badBodies) {
      await expect(updateLearnerProductStatuses(tx, ctx, body)).rejects.toThrow();
    }
    expect(mockRepository.listProductStatuses).not.toHaveBeenCalled();
    expect(mockRepository.updateProductStatuses).not.toHaveBeenCalled();
    expect(mockAuditWrite).not.toHaveBeenCalled();
  });

  it("caps a batch at 100 products", async () => {
    const tooMany = Array.from(
      { length: 101 },
      (_, index) => `66666666-6666-4666-8666-${String(index).padStart(12, "0")}`,
    );

    await expect(
      updateLearnerProductStatuses(tx, ctx, {
        productKind: "bundle",
        productIds: tooMany,
        status: "PUBLISHED",
      }),
    ).rejects.toThrow();
  });
});
