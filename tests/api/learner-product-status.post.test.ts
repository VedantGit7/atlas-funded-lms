import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level coverage for the catalogue publish/archive endpoint.
 *
 * The service has its own unit tests; this exercises the pipeline the service
 * sits behind — tenant resolution, authentication, the `course.update`
 * permission gate, body validation and the response envelope — by calling the
 * exported handler the way Next.js does. Only the repository is stubbed, so the
 * real service, the real DTOs and the real audit call all run.
 */

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";
const bundleA = "018f0000-0000-7000-8000-0000000000a1";
const bundleB = "018f0000-0000-7000-8000-0000000000a2";
const goneBundle = "018f0000-0000-7000-8000-0000000000a3";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockListProductStatuses,
  mockUpdateProductStatuses,
  auditWriterWriteMock,
  loggerInfoMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  // The pipeline claims an idempotency key through this tx, so the raw helpers
  // must resolve rather than return undefined.
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      $queryRaw: vi.fn(async (sql: TemplateStringsArray) =>
        sql.join("").includes("INSERT INTO idempotency_records")
          ? [{ id: "018f0000-0000-7000-8000-000000000088" }]
          : [],
      ),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
  mockListProductStatuses: vi.fn(),
  mockUpdateProductStatuses: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

// Swapped for a spy so the failure log can be asserted — and so the suite does
// not print a structured log line per request.
vi.mock("../../backend/packages/observability/src/logger", () => ({
  structuredLogger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireSupabaseUser: (...args: unknown[]) => mockRequireSupabaseUser(...args),
    upsertAuthPrincipal: (...args: unknown[]) => mockUpsertAuthPrincipal(...args),
  };
});

vi.mock("@atlas/membership", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireActiveMembership: (...args: unknown[]) => mockRequireActiveMembership(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => mockCan(...args),
    enforceEntitlement: vi.fn(),
  };
});

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: (...args: unknown[]) => auditWriterWriteMock(...args) },
}));

vi.mock(
  "../../backend/packages/domain/src/learner-products/learner-products.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      learnerProductsRepository: {
        listProductStatuses: (...args: unknown[]) => mockListProductStatuses(...args),
        updateProductStatuses: (...args: unknown[]) => mockUpdateProductStatuses(...args),
      },
    };
  },
);

const { POST } =
  await import("../../backend/apps/api/src/app/api/v1/learner-products/status/route");

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://tenant-a.example.com/api/v1/learner-products/status", {
    method: "POST",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "content-type": "application/json",
      "idempotency-key": `learner-product-status-${String(Math.random()).slice(2)}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function setupAuthenticatedAdmin() {
  mockResolveTenant.mockResolvedValue(tenantA);
  mockRequireSupabaseUser.mockResolvedValue({
    supabaseUserId: "018f0000-0000-7000-8000-000000000099",
    email: "admin@example.com",
    mfaEnabled: false,
  });
  mockUpsertAuthPrincipal.mockResolvedValue({
    id: "018f0000-0000-7000-8000-000000000098",
    email: "admin@example.com",
  });
  mockRequireActiveMembership.mockResolvedValue({
    membershipId: adminMembershipId,
    status: "ACTIVE",
  });
  mockCan.mockResolvedValue({
    allowed: true,
    permission: "course.update",
    reason: "ALLOWED",
    matchedRoleKeys: ["admin"],
    bypassedResourcePredicate: true,
  });
}

describe("POST /api/v1/learner-products/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin();
    auditWriterWriteMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-0000000000ff" });
    mockListProductStatuses.mockResolvedValue([
      { id: bundleA, slug: "trader-bundle", status: "DRAFT" },
      { id: bundleB, slug: "starter-pack", status: "DRAFT" },
    ]);
    mockUpdateProductStatuses.mockResolvedValue([
      { id: bundleA, slug: "trader-bundle", status: "PUBLISHED" },
      { id: bundleB, slug: "starter-pack", status: "PUBLISHED" },
    ]);
  });

  it("publishes a selection and returns what moved", async () => {
    const response = await POST(
      createRequest({
        productKind: "bundle",
        productIds: [bundleA, bundleB],
        status: "PUBLISHED",
      }),
    );
    const body = (await response.json()) as {
      data: {
        updated: Array<{ id: string; previousStatus: string; status: string }>;
        missingIds: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.updated).toHaveLength(2);
    expect(body.data.updated[0]).toMatchObject({
      id: bundleA,
      previousStatus: "DRAFT",
      status: "PUBLISHED",
    });
    expect(body.data.missingIds).toEqual([]);
  });

  it("runs the whole selection through a single tenant transaction", async () => {
    await POST(
      createRequest({
        productKind: "bundle",
        productIds: [bundleA, bundleB],
        status: "PUBLISHED",
      }),
    );

    expect(mockWithTenantTx).toHaveBeenCalledTimes(1);
    expect(mockUpdateProductStatuses).toHaveBeenCalledTimes(1);
  });

  it("writes one audit entry per product, attributed to the acting member", async () => {
    await POST(
      createRequest({
        productKind: "bundle",
        productIds: [bundleA, bundleB],
        status: "PUBLISHED",
      }),
    );

    expect(auditWriterWriteMock).toHaveBeenCalledTimes(2);
    const [, actor, entry] = auditWriterWriteMock.mock.calls[0] as [
      unknown,
      { tenantId: string; actorMembershipId: string },
      { action: string; before: { status: string }; after: { status: string } },
    ];
    expect(actor).toMatchObject({
      tenantId: tenantA.tenantId,
      actorMembershipId: adminMembershipId,
    });
    expect(entry.action).toBe("learner_product.bundle.status_changed");
    expect(entry.before).toEqual({ status: "DRAFT" });
    expect(entry.after).toEqual({ status: "PUBLISHED" });
  });

  it("gates on course.update", async () => {
    await POST(
      createRequest({ productKind: "bundle", productIds: [bundleA], status: "PUBLISHED" }),
    );

    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "course.update",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: adminMembershipId,
        }),
      }),
    );
  });

  it("refuses a member without course.update, touching nothing", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "course.update",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await POST(
      createRequest({ productKind: "bundle", productIds: [bundleA], status: "PUBLISHED" }),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockUpdateProductStatuses).not.toHaveBeenCalled();
    expect(auditWriterWriteMock).not.toHaveBeenCalled();
  });

  it("reports ids the tenant cannot see rather than failing the batch", async () => {
    mockListProductStatuses.mockResolvedValue([
      { id: bundleA, slug: "trader-bundle", status: "DRAFT" },
    ]);
    mockUpdateProductStatuses.mockResolvedValue([
      { id: bundleA, slug: "trader-bundle", status: "PUBLISHED" },
    ]);

    const response = await POST(
      createRequest({
        productKind: "bundle",
        productIds: [bundleA, goneBundle],
        status: "PUBLISHED",
      }),
    );
    const body = (await response.json()) as { data: { missingIds: string[] } };

    expect(response.status).toBe(200);
    expect(body.data.missingIds).toEqual([goneBundle]);
    expect(auditWriterWriteMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an unknown status", { productKind: "bundle", productIds: [bundleA], status: "LIVE" }],
    ["an unknown kind", { productKind: "course", productIds: [bundleA], status: "PUBLISHED" }],
    ["an empty selection", { productKind: "bundle", productIds: [], status: "PUBLISHED" }],
    [
      "a smuggled slug edit",
      { productKind: "bundle", productIds: [bundleA], status: "PUBLISHED", slug: "renamed" },
    ],
  ])("rejects %s as a 400, before reaching the database", async (_label, body) => {
    const response = await POST(createRequest(body));
    const parsed = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
    expect(mockListProductStatuses).not.toHaveBeenCalled();
    expect(mockUpdateProductStatuses).not.toHaveBeenCalled();
    expect(auditWriterWriteMock).not.toHaveBeenCalled();
  });

  it("requires an idempotency key", async () => {
    const request = new NextRequest("https://tenant-a.example.com/api/v1/learner-products/status", {
      method: "POST",
      headers: {
        host: "tenant-a.example.com",
        authorization: "Bearer access-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        productKind: "bundle",
        productIds: [bundleA],
        status: "PUBLISHED",
      }),
    });

    const response = await POST(request);
    const parsed = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
    expect(mockUpdateProductStatuses).not.toHaveBeenCalled();
  });

  /**
   * The failure log is what on-call reads. It named `INTERNAL_ERROR` for
   * ordinary bad input until the classifier was taught to ask the same envelope
   * the route answers with, so these two assertions have to move together.
   */
  it.each([
    [
      "a malformed body",
      () => undefined,
      { productKind: "bundle", productIds: [bundleA], status: "LIVE" },
      400,
      "VALIDATION_ERROR",
    ],
    [
      "a denied permission",
      () => {
        mockCan.mockResolvedValue({
          allowed: false,
          permission: "course.update",
          reason: "NO_ROLE_GRANT",
          safeMessage: "You do not have access to perform this action.",
        });
      },
      { productKind: "bundle", productIds: [bundleA], status: "PUBLISHED" },
      403,
      "PERMISSION_DENIED",
    ],
  ])(
    "logs %s under the same code it responds with",
    async (_label, arrange, body, expectedStatus, expectedCode) => {
      arrange();

      const response = await POST(createRequest(body));
      const parsed = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(expectedStatus);
      expect(parsed.error.code).toBe(expectedCode);

      const failures = loggerErrorMock.mock.calls
        .map(([fields]) => fields as { message: string; errorCode: string })
        .filter((fields) => fields.message === "route.failure");

      expect(failures).toHaveLength(1);
      expect(failures[0]?.errorCode).toBe(expectedCode);
    },
  );
});
