import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withPlatformScope } from "@atlas/db";
import type { withTenantTx as WithTenantTxFn } from "@atlas/db";
import * as membershipRepository from "../../backend/packages/membership/src/membership.repository";
import { requireActiveMembership } from "../../backend/packages/membership/src/membership-gate";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const {
  realWithTenantTx,
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockListTenantEntitlements,
  mockListTenantFeatureFlags,
  mockWithGlobalDb,
  mockWithTenantTx,
} = await vi.hoisted(async () => {
  const db = await vi.importActual<{ withTenantTx: typeof WithTenantTxFn }>("@atlas/db");
  return {
    realWithTenantTx: db.withTenantTx,
    mockResolveTenant: vi.fn(),
    mockRequireSupabaseUser: vi.fn(),
    mockUpsertAuthPrincipal: vi.fn(),
    mockRequireActiveMembership: vi.fn(),
    mockCan: vi.fn(),
    mockListTenantEntitlements: vi.fn(),
    mockListTenantFeatureFlags: vi.fn(),
    mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
    mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn({ $queryRaw: vi.fn() }),
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
  };
});

vi.mock("@atlas/domain-config/services/entitlement.service", () => ({
  listTenantEntitlements: (...args: unknown[]) => mockListTenantEntitlements(...args),
}));

vi.mock("@atlas/domain-config/services/feature-flag.service", () => ({
  listTenantFeatureFlags: (...args: unknown[]) => mockListTenantFeatureFlags(...args),
}));

import { GET as getEntitlements } from "../../backend/apps/api/src/app/api/v1/entitlements/route";
import { GET as getFeatureFlags } from "../../backend/apps/api/src/app/api/v1/feature-flags/route";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const tenantA = {
  tenantId: "tenant-a-id",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const tenantAEntitlements = {
  data: [
    {
      key: "entitlement.tenant-a",
      value: true,
      enabled: true,
      expiresAt: null,
    },
  ],
};

const tenantAFeatureFlags = {
  data: [
    {
      key: "community.enable",
      value: { tenantSlug: "tenant-a" },
      source: "TENANT_OVERRIDE" as const,
      readOnly: false,
    },
  ],
};

async function seedEntitlementsAndFeatureFlagOverrides(fixture: {
  tenantA: { tenantId: string; slug: string };
  tenantB: { tenantId: string; slug: string };
}) {
  const flagId = randomUUID();
  const flagKey = `community.enable.${fixture.tenantA.slug}`;

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      tenantId: fixture.tenantA.tenantId,
      touchedTenantIds: [fixture.tenantA.tenantId, fixture.tenantB.tenantId],
    },
    "Seeding entitlements and feature flag overrides for tenant isolation",
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO feature_flags (
          id,
          key,
          default_value,
          created_at,
          updated_at
        )
        VALUES (
          ${flagId}::uuid,
          ${flagKey},
          'false'::jsonb,
          now(),
          now()
        )
      `;

      for (const tenant of [fixture.tenantA, fixture.tenantB]) {
        await tx.$executeRaw`
          INSERT INTO entitlements (
            id,
            tenant_id,
            key,
            value_json,
            source,
            created_at,
            updated_at
          )
          VALUES (
            ${randomUUID()}::uuid,
            ${tenant.tenantId}::uuid,
            ${`entitlement.${tenant.slug}`},
            'true'::jsonb,
            'plan',
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO feature_flag_overrides (
            id,
            tenant_id,
            feature_flag_id,
            value_json,
            created_at,
            updated_at
          )
          VALUES (
            ${randomUUID()}::uuid,
            ${tenant.tenantId}::uuid,
            ${flagId}::uuid,
            ${JSON.stringify({ tenantSlug: tenant.slug })}::jsonb,
            now(),
            now()
          )
        `;
      }
    },
  );

  return { flagKey };
}

function createTenantARequest(path: string) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer shared-access-token",
    },
  });
}

describeWithDb("entitlements and feature flags tenant isolation (database)", () => {
  it("lets tenant A admin see tenant A entitlement rows and feature flag overrides", async () => {
    const fixture = await createTenantIsolationFixture();
    const { flagKey } = await seedEntitlementsAndFeatureFlagOverrides(fixture);

    const entitlements = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ key: string }>>`
        SELECT key
        FROM entitlements
        ORDER BY key ASC
      `;
    });

    expect(entitlements.map((row) => row.key)).toEqual([`entitlement.${fixture.tenantA.slug}`]);
    expect(entitlements.map((row) => row.key)).not.toContain(`entitlement.${fixture.tenantB.slug}`);

    const overrides = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ key: string; tenant_id: string }>>`
        SELECT ff.key, ffo.tenant_id::text AS tenant_id
        FROM feature_flag_overrides ffo
        JOIN feature_flags ff ON ff.id = ffo.feature_flag_id
        ORDER BY ff.key ASC
      `;
    });

    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({
      key: flagKey,
      tenant_id: fixture.tenantA.tenantId,
    });
  });

  it("does not expose tenant A rows on tenant B host", async () => {
    const fixture = await createTenantIsolationFixture();
    await seedEntitlementsAndFeatureFlagOverrides(fixture);

    const entitlements = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ key: string }>>`
        SELECT key
        FROM entitlements
        ORDER BY key ASC
      `;
    });

    expect(entitlements.map((row) => row.key)).toEqual([`entitlement.${fixture.tenantB.slug}`]);
    expect(entitlements.map((row) => row.key)).not.toContain(`entitlement.${fixture.tenantA.slug}`);

    const overrides = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT ffo.tenant_id::text AS tenant_id
        FROM feature_flag_overrides ffo
        ORDER BY ffo.created_at ASC
      `;
    });

    expect(overrides.every((row) => row.tenant_id === fixture.tenantB.tenantId)).toBe(true);
    expect(overrides.some((row) => row.tenant_id === fixture.tenantA.tenantId)).toBe(false);
  });
});

describe("entitlements and feature flags tenant isolation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockResolveTenant.mockReset();
    mockRequireSupabaseUser.mockReset();
    mockUpsertAuthPrincipal.mockReset();
    mockRequireActiveMembership.mockReset();
    mockCan.mockReset();
    mockListTenantEntitlements.mockReset();
    mockListTenantFeatureFlags.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithTenantTx.mockClear();

    mockResolveTenant.mockResolvedValue(tenantA);
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
      membershipId: "tenant-a-admin-membership",
      status: "ACTIVE",
    });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "entitlement.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
    mockListTenantEntitlements.mockResolvedValue(tenantAEntitlements);
    mockListTenantFeatureFlags.mockResolvedValue(tenantAFeatureFlags);
  });

  it("returns NO_MEMBERSHIP on tenant B host when the same JWT principal has no tenant B membership", async () => {
    vi.spyOn(membershipRepository, "findMembershipByPrincipal").mockResolvedValue(null);

    await expect(
      requireActiveMembership({
        tx: { $queryRaw: vi.fn() },
        tenantId: "tenant-b-id",
        authPrincipalId: "principal-with-tenant-a-membership",
      }),
    ).rejects.toMatchObject({
      code: "NO_MEMBERSHIP",
      status: 403,
    });
  });

  it("rejects guessed tenant B tenant_id and keeps tenant A scope on GET /entitlements", async () => {
    const rejected = await getEntitlements(
      createTenantARequest("/api/v1/entitlements?tenant_id=tenant-b-id"),
    );
    const rejectedBody = (await rejected.json()) as {
      error: { code: string };
    };

    expect(rejected.status).toBe(400);
    expect(rejectedBody.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();

    mockWithTenantTx.mockClear();

    const allowed = await getEntitlements(createTenantARequest("/api/v1/entitlements"));
    const allowedBody: unknown = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual(tenantAEntitlements);
    expect(mockResolveTenant).toHaveBeenCalled();
    expect(mockListTenantEntitlements).toHaveBeenCalledTimes(1);
  });

  it("rejects guessed tenant B tenant_id and keeps tenant A scope on GET /feature-flags", async () => {
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "feature_flag.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });

    const rejected = await getFeatureFlags(
      createTenantARequest("/api/v1/feature-flags?tenant_id=tenant-b-id"),
    );
    const rejectedBody = (await rejected.json()) as {
      error: { code: string };
    };

    expect(rejected.status).toBe(400);
    expect(rejectedBody.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();

    mockWithTenantTx.mockClear();

    const allowed = await getFeatureFlags(createTenantARequest("/api/v1/feature-flags"));
    const allowedBody: unknown = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual(tenantAFeatureFlags);
    expect(mockListTenantFeatureFlags).toHaveBeenCalledTimes(1);
  });
});
