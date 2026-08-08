import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withPlatformScope } from "@atlas/db";
import type {
  withPlatformScope as WithPlatformScopeFn,
  withTenantTx as WithTenantTxFn,
} from "@atlas/db";
import { readTenantAuditLog } from "@atlas/audit/services/audit-reader.service";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const {
  realWithTenantTx,
  platformScopeTestMode,
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantAuditLog,
  mockReadPlatformAuditLog,
  mockRequirePlatformPrincipal,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockWithPlatformScope,
} = await vi.hoisted(async () => {
  const db = await vi.importActual<{
    withTenantTx: typeof WithTenantTxFn;
    withPlatformScope: typeof WithPlatformScopeFn;
  }>("@atlas/db");
  const platformScopeTestMode = { useReal: false };
  return {
    realWithTenantTx: db.withTenantTx,
    platformScopeTestMode,
    mockResolveTenant: vi.fn(),
    mockRequireSupabaseUser: vi.fn(),
    mockUpsertAuthPrincipal: vi.fn(),
    mockRequireActiveMembership: vi.fn(),
    mockCan: vi.fn(),
    mockReadTenantAuditLog: vi.fn(),
    mockReadPlatformAuditLog: vi.fn(),
    mockRequirePlatformPrincipal: vi.fn(),
    mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
    mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn({ $queryRaw: vi.fn() }),
    ),
    mockWithPlatformScope: vi.fn(
      (
        ctx: Parameters<typeof WithPlatformScopeFn>[0],
        reason: string,
        fn: Parameters<typeof WithPlatformScopeFn>[2],
      ) => {
        if (platformScopeTestMode.useReal) {
          return db.withPlatformScope(ctx, reason, fn);
        }
        return fn({ $queryRaw: vi.fn() } as Parameters<typeof fn>[0]);
      },
    ),
  };
});

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

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mockRequirePlatformPrincipal(...args),
}));

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

vi.mock("@atlas/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    withPlatformScope: mockWithPlatformScope,
  };
});

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => mockCan(...args),
  };
});

vi.mock("@atlas/audit", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readTenantAuditLog: (...args: unknown[]) => mockReadTenantAuditLog(...args),
    readPlatformAuditLog: (...args: unknown[]) => mockReadPlatformAuditLog(...args),
  };
});

import { GET as getTenantAudit } from "../../backend/apps/api/src/app/api/v1/audit/route";
import { GET as getPlatformAudit } from "../../backend/apps/api/src/app/api/v1/platform/audit/route";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const tenantAHost = {
  tenantId: "tenant-a-id",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const tenantAAdminMembershipId = "018f0000-0000-7000-8000-000000000088";

const tenantAAuditPayload = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000001",
      occurredAt: "2025-01-01T00:00:00.000Z",
      action: "audit.isolation.tenant-a",
      targetType: "tenant",
      targetId: null,
      actorMembershipId: tenantAAdminMembershipId,
      platformPrincipalId: null,
      requestId: "req-tenant-a",
      reason: null,
      metadata: null,
    },
  ],
  page: {
    hasMore: false,
    nextCursor: null,
  },
};

async function seedAuditAndOutboxRows(fixture: {
  tenantA: { tenantId: string; slug: string; membershipId: string };
  tenantB: { tenantId: string; slug: string; membershipId: string };
}) {
  const tenantAOutboxId = randomUUID();
  const tenantADeadLetterId = randomUUID();
  const tenantAAuditId = randomUUID();
  const tenantBAuditId = randomUUID();
  const platformAuditId = randomUUID();

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      touchedTenantIds: [fixture.tenantA.tenantId, fixture.tenantB.tenantId],
    },
    "Seeding audit and outbox rows for tenant isolation",
    async (tx) => {
      for (const tenant of [fixture.tenantA, fixture.tenantB]) {
        await tx.$executeRaw`
          INSERT INTO audit_entries (
            id,
            tenant_id,
            actor_membership_id,
            actor_principal_id,
            action,
            target_type,
            target_id,
            request_id,
            before_json,
            after_json,
            metadata_json,
            entry_hash,
            occurred_at
          )
          VALUES (
            ${tenant === fixture.tenantA ? tenantAAuditId : tenantBAuditId}::uuid,
            ${tenant.tenantId}::uuid,
            ${tenant.membershipId}::uuid,
            NULL,
            ${`audit.isolation.${tenant.slug}`},
            'tenant',
            NULL,
            ${`req-${tenant.slug}`},
            NULL,
            NULL,
            '{}'::jsonb,
            'pending-db-hash-chain',
            now()
          )
        `;
      }

      await tx.$executeRaw`
        INSERT INTO audit_entries (
          id,
          tenant_id,
          actor_membership_id,
          actor_principal_id,
          action,
          target_type,
          target_id,
          request_id,
          before_json,
          after_json,
          metadata_json,
          entry_hash,
          occurred_at
        )
        VALUES (
          ${platformAuditId}::uuid,
          NULL,
          NULL,
          ${randomUUID()}::uuid,
          'platform.scope.enter',
          'platform_scope',
          NULL,
          'req-platform-audit',
          NULL,
          NULL,
          '{"reason":"platform isolation seed"}'::jsonb,
          'pending-db-hash-chain',
          now()
        )
      `;

      await tx.$executeRaw`
        INSERT INTO outbox_events (
          id,
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload_json,
          metadata_json,
          available_at
        )
        VALUES (
          ${tenantAOutboxId}::uuid,
          ${fixture.tenantA.tenantId}::uuid,
          'course.published',
          'course',
          ${fixture.tenantA.tenantId},
          ${JSON.stringify({ tenantSlug: fixture.tenantA.slug })}::jsonb,
          '{"requestId":"req-outbox-a"}'::jsonb,
          now()
        )
      `;

      await tx.$executeRaw`
        INSERT INTO dead_letter_events (
          id,
          tenant_id,
          outbox_event_id,
          destination_key,
          error_json,
          failed_at
        )
        VALUES (
          ${tenantADeadLetterId}::uuid,
          ${fixture.tenantA.tenantId}::uuid,
          ${tenantAOutboxId}::uuid,
          'analytics.projection',
          '{"code":"HANDLER_FAILED","message":"seeded failure"}'::jsonb,
          now()
        )
      `;
    },
  );

  return {
    tenantAAuditId,
    tenantBAuditId,
    tenantAOutboxId,
    tenantADeadLetterId,
    platformAuditId,
  };
}

function createTenantARequest(path: string) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer token-with-tenant-b-claim",
      "x-tenant-id": "tenant-b-id",
      "x-atlas-tenant-id": "tenant-b-id",
    },
  });
}

describeWithDb("audit and outbox tenant isolation (database)", () => {
  beforeEach(() => {
    platformScopeTestMode.useReal = true;
  });

  afterEach(() => {
    platformScopeTestMode.useReal = false;
  });

  it("lets tenant A read tenant A audit records", async () => {
    const fixture = await createTenantIsolationFixture();
    await seedAuditAndOutboxRows(fixture);

    const response = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return readTenantAuditLog(tx, { limit: 25 });
    });

    expect(response.data.map((entry) => entry.action)).toEqual([
      `audit.isolation.${fixture.tenantA.slug}`,
    ]);
  });

  it("does not expose tenant B audit records to tenant A", async () => {
    const fixture = await createTenantIsolationFixture();
    await seedAuditAndOutboxRows(fixture);

    const rows = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ action: string }>>`
        SELECT action
        FROM audit_entries
        WHERE action = ${`audit.isolation.${fixture.tenantB.slug}`}
      `;
    });

    expect(rows).toHaveLength(0);
  });

  it("does not let tenant A infer tenant B audit existence via id lookup", async () => {
    const fixture = await createTenantIsolationFixture();
    const seeded = await seedAuditAndOutboxRows(fixture);

    const byId = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM audit_entries
        WHERE id = ${seeded.tenantBAuditId}::uuid
      `;
    });

    const byMissingId = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM audit_entries
        WHERE id = ${randomUUID()}::uuid
      `;
    });

    expect(byId).toHaveLength(0);
    expect(byMissingId).toHaveLength(0);
  });

  it("does not expose tenant A outbox rows on tenant B host context", async () => {
    const fixture = await createTenantIsolationFixture();
    const seeded = await seedAuditAndOutboxRows(fixture);

    const rows = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM outbox_events
        WHERE id = ${seeded.tenantAOutboxId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });

  it("does not expose tenant A dead-letter rows on tenant B host context", async () => {
    const fixture = await createTenantIsolationFixture();
    const seeded = await seedAuditAndOutboxRows(fixture);

    const rows = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM dead_letter_events
        WHERE id = ${seeded.tenantADeadLetterId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });

  it("keeps platform audit rows out of tenant transactions", async () => {
    const fixture = await createTenantIsolationFixture();
    const seeded = await seedAuditAndOutboxRows(fixture);

    const rows = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text
        FROM audit_entries
        WHERE id = ${seeded.platformAuditId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });
});

describe("audit and outbox tenant isolation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockResolveTenant.mockReset();
    mockRequireSupabaseUser.mockReset();
    mockUpsertAuthPrincipal.mockReset();
    mockRequireActiveMembership.mockReset();
    mockCan.mockReset();
    mockReadTenantAuditLog.mockReset();
    mockReadPlatformAuditLog.mockReset();
    mockRequirePlatformPrincipal.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithTenantTx.mockClear();
    mockWithPlatformScope.mockClear();

    mockResolveTenant.mockResolvedValue(tenantAHost);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "018f0000-0000-7000-8000-000000000001",
      email: "admin@tenant-a.example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000099",
      email: "admin@tenant-a.example.com",
    });
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: tenantAAdminMembershipId,
      status: "ACTIVE",
    });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "audit.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
    mockReadTenantAuditLog.mockResolvedValue(tenantAAuditPayload);
    mockReadPlatformAuditLog.mockResolvedValue({
      data: [],
      page: { hasMore: false, nextCursor: null },
    });
    mockRequirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
      platformPermissions: ["platform.audit.read"],
    });
  });

  it("rejects guessed tenant B tenant_id on GET /audit", async () => {
    const rejected = await getTenantAudit(
      createTenantARequest("/api/v1/audit?tenant_id=tenant-b-id"),
    );
    const rejectedBody = (await rejected.json()) as {
      error: { code: string };
    };

    expect(rejected.status).toBe(400);
    expect(rejectedBody.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });

  it("keeps tenant A scope when host wins over JWT and client tenant headers", async () => {
    const allowed = await getTenantAudit(createTenantARequest("/api/v1/audit"));
    const allowedBody: unknown = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual(tenantAAuditPayload);
    expect(mockResolveTenant).toHaveBeenCalled();
    expect(mockReadTenantAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWithPlatformScope).not.toHaveBeenCalled();
  });

  it("requires withPlatformScope for platform audit access", async () => {
    await getPlatformAudit(
      new NextRequest("https://platform.example.com/api/v1/platform/audit", {
        headers: {
          host: "platform.example.com",
          authorization: "Bearer platform-token",
          [ATLAS_PLATFORM_REASON_HEADER]: "Reviewing platform audit trail for compliance",
        },
      }),
    );

    expect(mockWithPlatformScope).toHaveBeenCalledTimes(1);
    expect(mockWithTenantTx).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
  });

  it("does not enter platform scope from the tenant audit route", async () => {
    await getTenantAudit(createTenantARequest("/api/v1/audit"));

    expect(mockWithTenantTx).toHaveBeenCalled();
    expect(mockWithPlatformScope).not.toHaveBeenCalled();
    expect(mockRequirePlatformPrincipal).not.toHaveBeenCalled();
  });
});
