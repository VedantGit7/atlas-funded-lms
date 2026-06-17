import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withPlatformScope } from "@atlas/db";
import type {
  withPlatformScope as WithPlatformScopeFn,
  withTenantTx as WithTenantTxFn,
} from "@atlas/db";
import { readPlatformTenantDetail } from "@atlas/domain-tenancy/services/platform-tenant-read.service";
import { seedTenantSystemRolesFromCatalogue } from "@atlas/domain-tenancy/services/platform-tenant-provisioning.helpers";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import type * as GlobalDbModule from "@atlas/db/global-db";

const {
  realWithTenantTx,
  realWithGlobalDb,
  platformScopeTestMode,
  globalDbTestMode,
  mockRequirePlatformPrincipal,
  mockReadPlatformTenantDetail,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockWithPlatformScope,
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockListTenantEntitlements,
} = await vi.hoisted(async () => {
  const db = await vi.importActual<{
    withTenantTx: typeof WithTenantTxFn;
    withPlatformScope: typeof WithPlatformScopeFn;
  }>("@atlas/db");
  const globalDb = await vi.importActual<typeof GlobalDbModule>("@atlas/db/global-db");
  const platformScopeTestMode = { useReal: false };
  const globalDbTestMode = { useReal: false };
  return {
    realWithTenantTx: db.withTenantTx,
    realWithGlobalDb: globalDb.withGlobalDb,
    platformScopeTestMode,
    globalDbTestMode,
    mockRequirePlatformPrincipal: vi.fn(),
    mockReadPlatformTenantDetail: vi.fn(),
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
        return fn({ $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as Parameters<
          typeof fn
        >[0]);
      },
    ),
    mockResolveTenant: vi.fn(),
    mockRequireSupabaseUser: vi.fn(),
    mockUpsertAuthPrincipal: vi.fn(),
    mockRequireActiveMembership: vi.fn(),
    mockCan: vi.fn(),
    mockListTenantEntitlements: vi.fn(),
  };
});

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mockRequirePlatformPrincipal(...args),
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
  withGlobalDb: (fn: Parameters<typeof realWithGlobalDb>[0]) => {
    if (globalDbTestMode.useReal) {
      return realWithGlobalDb(fn);
    }
    return mockWithGlobalDb(fn as (db: unknown) => unknown);
  },
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

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => mockCan(...args),
  };
});

vi.mock("@atlas/domain-tenancy", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readPlatformTenantDetail: (...args: unknown[]) => mockReadPlatformTenantDetail(...args),
  };
});

vi.mock("@atlas/domain-config/services/entitlement.service", () => ({
  listTenantEntitlements: (...args: unknown[]) => mockListTenantEntitlements(...args),
}));

import { GET as getPlatformTenantDetail } from "../../apps/web/src/app/api/v1/platform/tenants/[id]/route";
import { GET as getEntitlements } from "../../apps/web/src/app/api/v1/entitlements/route";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const tenantBaseDomain = process.env["TENANT_BASE_DOMAIN"] ?? "localhost.test";

type ProvisionedTenantFixture = {
  tenantId: string;
  slug: string;
  hostname: string;
  ownerPrincipalId: string;
  ownerMembershipId: string;
  configId: string;
};

type ProvisionedIsolationFixture = {
  tenantA: ProvisionedTenantFixture;
  tenantB: ProvisionedTenantFixture;
};

function suffix(): string {
  return randomUUID().slice(0, 8);
}

async function seedOwnerMembershipAndConfig(
  tx: Parameters<Parameters<typeof withPlatformScope>[2]>[0],
  tenant: { tenantId: string; slug: string },
): Promise<Pick<ProvisionedTenantFixture, "ownerPrincipalId" | "ownerMembershipId" | "configId">> {
  const ownerPrincipalId = randomUUID();
  const ownerMembershipId = randomUUID();
  const configId = randomUUID();

  await tx.$executeRaw`
    INSERT INTO auth_principals (
      id,
      supabase_user_id,
      email,
      email_normalized,
      global_status,
      created_at,
      updated_at
    )
    VALUES (
      ${ownerPrincipalId}::uuid,
      ${randomUUID()}::uuid,
      ${`${tenant.slug}-owner@example.test`},
      ${`${tenant.slug}-owner@example.test`},
      'active',
      now(),
      now()
    )
  `;

  await tx.$executeRaw`
    INSERT INTO memberships (
      id,
      tenant_id,
      auth_principal_id,
      status,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      ${ownerMembershipId}::uuid,
      ${tenant.tenantId}::uuid,
      ${ownerPrincipalId}::uuid,
      'ACTIVE',
      now(),
      now(),
      now()
    )
  `;

  await tx.$executeRaw`
    INSERT INTO tenant_config (
      id,
      tenant_id,
      config_json,
      created_at,
      updated_at
    )
    VALUES (
      ${configId}::uuid,
      ${tenant.tenantId}::uuid,
      ${JSON.stringify({ slug: tenant.slug })}::jsonb,
      now(),
      now()
    )
  `;

  return { ownerPrincipalId, ownerMembershipId, configId };
}

async function provisionIsolationTenant(
  label: "a" | "b",
  runId: string,
): Promise<ProvisionedTenantFixture> {
  const slug = `iso-prov-${label}-${runId}`;
  const hostname = `${slug}.${tenantBaseDomain}`;
  const tenantId = randomUUID();
  const platformPrincipalId = randomUUID();
  const requestId = randomUUID();

  await withPlatformScope(
    {
      principalId: platformPrincipalId,
      requestId,
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
    },
    "Provisioning tenant for platform isolation test",
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO tenants (
          id,
          slug,
          display_name,
          state,
          default_locale,
          default_timezone,
          created_at,
          updated_at
        )
        VALUES (
          ${tenantId}::uuid,
          ${slug},
          ${`Isolation ${label.toUpperCase()}`},
          'ACTIVE',
          'en',
          'UTC',
          now(),
          now()
        )
      `;

      await tx.$executeRaw`
        INSERT INTO tenant_domains (
          id,
          tenant_id,
          hostname,
          type,
          status,
          is_primary,
          created_at,
          updated_at
        )
        VALUES (
          ${randomUUID()}::uuid,
          ${tenantId}::uuid,
          ${hostname},
          'atlas_subdomain',
          'ACTIVE'::"DomainStatus",
          true,
          now(),
          now()
        )
      `;

      await seedTenantSystemRolesFromCatalogue(tx, { tenantId });
      await seedOwnerMembershipAndConfig(tx, { tenantId, slug });
    },
  );

  const seeded = await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.read",
      platformPermissions: ["platform.tenant.read"],
      tenantId,
      touchedTenantIds: [tenantId],
    },
    "Reading provisioned tenant config for isolation fixture",
    async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ owner_principal_id: string; owner_membership_id: string; config_id: string }>
      >`
        SELECT
          m.auth_principal_id::text AS owner_principal_id,
          m.id::text AS owner_membership_id,
          tc.id::text AS config_id
        FROM memberships m
        JOIN tenant_config tc ON tc.tenant_id = m.tenant_id
        WHERE m.tenant_id = ${tenantId}::uuid
        LIMIT 1
      `;

      return rows[0];
    },
  );

  if (seeded === undefined) {
    throw new Error(`Expected seeded owner/config for ${slug}`);
  }

  return {
    tenantId,
    slug,
    hostname,
    ownerPrincipalId: seeded.owner_principal_id,
    ownerMembershipId: seeded.owner_membership_id,
    configId: seeded.config_id,
  };
}

async function createProvisionedIsolationFixture(): Promise<ProvisionedIsolationFixture> {
  const runId = suffix();
  const tenantA = await provisionIsolationTenant("a", runId);
  const tenantB = await provisionIsolationTenant("b", runId);
  return { tenantA, tenantB };
}

function provisionedTenantCtx(tenant: ProvisionedTenantFixture, requestId = randomUUID()) {
  return {
    tenantId: tenant.tenantId,
    actorMembershipId: tenant.ownerMembershipId,
    requestId,
  };
}
function createTenantHostRequest(hostname: string, path: string, tenantBId: string) {
  return new NextRequest(`https://${hostname}${path}`, {
    headers: {
      host: hostname,
      authorization: "Bearer token-with-tenant-b-claim",
      "x-tenant-id": tenantBId,
      "x-atlas-tenant-id": tenantBId,
    },
  });
}

function createPlatformDetailRequest(tenantId: string, reason: string) {
  return new NextRequest(`https://platform.example.com/api/v1/platform/tenants/${tenantId}`, {
    headers: {
      host: "platform.example.com",
      authorization: "Bearer platform-token",
      [ATLAS_PLATFORM_REASON_HEADER]: reason,
    },
  });
}

describeWithDb("platform provisioning tenant isolation (database)", () => {
  beforeEach(() => {
    platformScopeTestMode.useReal = true;
    globalDbTestMode.useReal = true;
  });

  afterEach(() => {
    platformScopeTestMode.useReal = false;
    globalDbTestMode.useReal = false;
  });

  it("does not expose provisioned tenant B from tenant A host context", async () => {
    const fixture = await createProvisionedIsolationFixture();

    const domains = await realWithTenantTx(provisionedTenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; hostname: string }>>`
        SELECT tenant_id::text, hostname
        FROM tenant_domains
        WHERE tenant_id IN (${fixture.tenantA.tenantId}::uuid, ${fixture.tenantB.tenantId}::uuid)
        ORDER BY hostname ASC
      `;
    });

    expect(domains).toHaveLength(1);
    expect(domains[0]).toMatchObject({
      tenant_id: fixture.tenantA.tenantId,
      hostname: fixture.tenantA.hostname,
    });
  });

  it("blocks cross-tenant rows for seeded owner, membership, domain, and config", async () => {
    const fixture = await createProvisionedIsolationFixture();

    const memberships = await realWithTenantTx(
      provisionedTenantCtx(fixture.tenantA),
      async (tx) => {
        return tx.$queryRaw<Array<{ id: string; tenant_id: string }>>`
        SELECT id::text, tenant_id::text
        FROM memberships
        WHERE id IN (${fixture.tenantA.ownerMembershipId}::uuid, ${fixture.tenantB.ownerMembershipId}::uuid)
        ORDER BY id ASC
      `;
      },
    );

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.tenant_id).toBe(fixture.tenantA.tenantId);

    const configs = await realWithTenantTx(provisionedTenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string; tenant_id: string }>>`
        SELECT id::text, tenant_id::text
        FROM tenant_config
        WHERE id IN (${fixture.tenantA.configId}::uuid, ${fixture.tenantB.configId}::uuid)
        ORDER BY id ASC
      `;
    });

    expect(configs).toHaveLength(1);
    expect(configs[0]?.tenant_id).toBe(fixture.tenantA.tenantId);

    const domains = await realWithTenantTx(provisionedTenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT tenant_id::text
        FROM tenant_domains
        WHERE tenant_id = ${fixture.tenantB.tenantId}::uuid
      `;
    });

    expect(domains).toHaveLength(0);
  });

  it("registers ACTIVE primary domains for provisioned tenants used in host resolution", async () => {
    const fixture = await createProvisionedIsolationFixture();

    const domains = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: fixture.tenantA.tenantId,
        touchedTenantIds: [fixture.tenantA.tenantId, fixture.tenantB.tenantId],
      },
      "Verifying provisioned tenant domains for host resolution",
      async (tx) => {
        return tx.$queryRaw<Array<{ tenant_id: string; hostname: string; status: string }>>`
          SELECT tenant_id::text, hostname, status::text
          FROM tenant_domains
          WHERE tenant_id IN (${fixture.tenantA.tenantId}::uuid, ${fixture.tenantB.tenantId}::uuid)
            AND is_primary = true
          ORDER BY hostname ASC
        `;
      },
    );

    expect(domains).toEqual([
      {
        tenant_id: fixture.tenantA.tenantId,
        hostname: fixture.tenantA.hostname,
        status: "ACTIVE",
      },
      {
        tenant_id: fixture.tenantB.tenantId,
        hostname: fixture.tenantB.hostname,
        status: "ACTIVE",
      },
    ]);
  });

  it("inspects provisioned tenants only through withPlatformScope", async () => {
    const fixture = await createProvisionedIsolationFixture();

    const blockedDomains = await realWithTenantTx(
      provisionedTenantCtx(fixture.tenantA),
      async (tx) => {
        return tx.$queryRaw<Array<{ hostname: string }>>`
        SELECT hostname
        FROM tenant_domains
        WHERE tenant_id = ${fixture.tenantB.tenantId}::uuid
      `;
      },
    );

    expect(blockedDomains).toHaveLength(0);

    const tenantADetail = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: fixture.tenantA.tenantId,
        touchedTenantIds: [fixture.tenantA.tenantId],
      },
      "Inspecting provisioned tenant A for isolation verification",
      async (tx) => readPlatformTenantDetail(tx, fixture.tenantA.tenantId),
    );

    const tenantBDetail = await withPlatformScope(
      {
        principalId: randomUUID(),
        requestId: randomUUID(),
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        tenantId: fixture.tenantB.tenantId,
        touchedTenantIds: [fixture.tenantB.tenantId],
      },
      "Inspecting provisioned tenant B for isolation verification",
      async (tx) => readPlatformTenantDetail(tx, fixture.tenantB.tenantId),
    );

    expect(tenantADetail.data.slug).toBe(fixture.tenantA.slug);
    expect(tenantBDetail.data.slug).toBe(fixture.tenantB.slug);
  });
});

describe("platform provisioning tenant isolation (routes)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockRequirePlatformPrincipal.mockReset();
    mockReadPlatformTenantDetail.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithTenantTx.mockClear();
    mockWithPlatformScope.mockClear();
    mockResolveTenant.mockReset();
    mockRequireSupabaseUser.mockReset();
    mockUpsertAuthPrincipal.mockReset();
    mockRequireActiveMembership.mockReset();
    mockCan.mockReset();
    mockListTenantEntitlements.mockReset();

    mockRequirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
      platformPermissions: ["platform.tenant.read"],
    });
    mockReadPlatformTenantDetail.mockResolvedValue({
      data: {
        id: "tenant-b-id",
        slug: "tenant-b",
        displayName: "Tenant B",
        legalName: null,
        state: "ACTIVE",
        defaultLocale: "en",
        defaultTimezone: "UTC",
        primaryDomain: null,
        provisioning: { latestJobId: null, latestStatus: null },
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    });
    mockResolveTenant.mockResolvedValue({
      tenantId: "tenant-a-id",
      tenantSlug: "tenant-a",
      tenantState: "ACTIVE",
    });
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
    mockListTenantEntitlements.mockResolvedValue({ data: [] });
  });

  it("denies tenant A users guessing tenant B id on the platform tenant detail route", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await getPlatformTenantDetail(
      createPlatformDetailRequest(
        "018f0000-0000-7000-8000-000000000099",
        "Inspecting guessed tenant for support triage",
      ),
      { params: Promise.resolve({ id: "018f0000-0000-7000-8000-000000000099" }) },
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadPlatformTenantDetail).not.toHaveBeenCalled();
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });

  it("rejects guessed tenant B tenant_id on tenant routes scoped to tenant A host", async () => {
    const response = await getEntitlements(
      createTenantHostRequest(
        "tenant-a.example.com",
        "/api/v1/entitlements?tenant_id=tenant-b-id",
        "tenant-b-id",
      ),
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });

  it("keeps tenant A scope when host wins over JWT and client tenant headers", async () => {
    const allowed = await getEntitlements(
      createTenantHostRequest("tenant-a.example.com", "/api/v1/entitlements", "tenant-b-id"),
    );
    const allowedBody: unknown = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual({ data: [] });
    expect(mockResolveTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        req: expect.any(Request),
      }),
    );
    expect(mockListTenantEntitlements).toHaveBeenCalledTimes(1);
    expect(mockWithTenantTx).toHaveBeenCalled();
  });

  it("requires withPlatformScope for platform tenant inspection", async () => {
    await getPlatformTenantDetail(
      createPlatformDetailRequest(
        "018f0000-0000-7000-8000-000000000001",
        "Inspecting provisioned tenant for support triage",
      ),
      { params: Promise.resolve({ id: "018f0000-0000-7000-8000-000000000001" }) },
    );

    expect(mockWithPlatformScope).toHaveBeenCalledTimes(1);
    expect(mockWithTenantTx).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
  });

  it("requires a platform reason for platform tenant inspection", async () => {
    const response = await getPlatformTenantDetail(
      createPlatformDetailRequest("018f0000-0000-7000-8000-000000000001", ""),
      { params: Promise.resolve({ id: "018f0000-0000-7000-8000-000000000001" }) },
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithPlatformScope).not.toHaveBeenCalled();
    expect(mockReadPlatformTenantDetail).not.toHaveBeenCalled();
  });
});
