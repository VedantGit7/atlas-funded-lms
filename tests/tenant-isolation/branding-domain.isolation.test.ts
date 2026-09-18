import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withPlatformScope } from "@atlas/db";
import type { withTenantTx as WithTenantTxFn } from "@atlas/db";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { disableTenantDomain } from "@atlas/domain-branding/repositories/domain.repository";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const {
  realWithTenantTx,
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantBranding,
  mockReadTenantDomains,
  mockReadTenantBrandingVersions,
  mockDeleteTenantDomain,
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
    mockReadTenantBranding: vi.fn(),
    mockReadTenantDomains: vi.fn(),
    mockReadTenantBrandingVersions: vi.fn(),
    mockDeleteTenantDomain: vi.fn(),
    mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
    mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        // A bare vi.fn() returns undefined, so any repository doing rows[0]
        // throws before the handler is reached. The route pipeline now claims an
        // idempotency key through this tx (M10), and this test asserts the
        // handler *was* reached with tenant A scope -- so the stub has to model
        // a raw query returning no rows rather than returning nothing at all.
        $queryRaw: vi.fn().mockResolvedValue([]),
        $queryRawUnsafe: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn().mockResolvedValue(0),
        $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      }),
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

vi.mock("@atlas/domain-branding", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readTenantBranding: (...args: unknown[]) => mockReadTenantBranding(...args),
    readTenantDomains: (...args: unknown[]) => mockReadTenantDomains(...args),
    readTenantBrandingVersions: (...args: unknown[]) => mockReadTenantBrandingVersions(...args),
    deleteTenantDomain: (...args: unknown[]) => mockDeleteTenantDomain(...args),
  };
});

import { GET as getBranding } from "../../backend/apps/api/src/app/api/v1/branding/route";
import { GET as getDomains } from "../../backend/apps/api/src/app/api/v1/domains/route";
import { GET as getBrandingVersions } from "../../backend/apps/api/src/app/api/v1/branding/versions/route";
import { DELETE as deleteDomain } from "../../backend/apps/api/src/app/api/v1/domains/[id]/route";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type BrandingDomainSeed = {
  brandingId: string;
  themeId: string;
  domainId: string;
  versionId: string;
  displayName: string;
  primaryColor: string;
  hostname: string;
};

type BrandingDomainFixture = {
  tenantA: BrandingDomainSeed;
  tenantB: BrandingDomainSeed;
};

async function seedBrandingDomainFixture(
  tenantA: { tenantId: string; slug: string; membershipId: string },
  tenantB: { tenantId: string; slug: string; membershipId: string },
): Promise<BrandingDomainFixture> {
  const tenantASeed: BrandingDomainSeed = {
    brandingId: randomUUID(),
    themeId: randomUUID(),
    domainId: randomUUID(),
    versionId: randomUUID(),
    displayName: `Branding ${tenantA.slug}`,
    primaryColor: "#111111",
    hostname: `${tenantA.slug}.isolation.test`,
  };
  const tenantBSeed: BrandingDomainSeed = {
    brandingId: randomUUID(),
    themeId: randomUUID(),
    domainId: randomUUID(),
    versionId: randomUUID(),
    displayName: `Branding ${tenantB.slug}`,
    primaryColor: "#222222",
    hostname: `${tenantB.slug}.isolation.test`,
  };

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      touchedTenantIds: [tenantA.tenantId, tenantB.tenantId],
    },
    "Seeding branding, theme, domain, and version rows for tenant isolation",
    async (tx) => {
      for (const [tenant, seed] of [
        [tenantA, tenantASeed],
        [tenantB, tenantBSeed],
      ] as const) {
        await tx.$executeRaw`
          INSERT INTO tenant_branding (
            id,
            tenant_id,
            display_name,
            created_at,
            updated_at
          )
          VALUES (
            ${seed.brandingId}::uuid,
            ${tenant.tenantId}::uuid,
            ${seed.displayName},
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO tenant_theme (
            id,
            tenant_id,
            primary_color,
            token_json,
            created_at,
            updated_at
          )
          VALUES (
            ${seed.themeId}::uuid,
            ${tenant.tenantId}::uuid,
            ${seed.primaryColor},
            ${JSON.stringify({ primary: seed.primaryColor })}::jsonb,
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
            ${seed.domainId}::uuid,
            ${tenant.tenantId}::uuid,
            ${seed.hostname},
            'ATLAS_SUBDOMAIN',
            'ACTIVE'::"DomainStatus",
            true,
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO tenant_branding_version (
            id,
            tenant_id,
            version,
            snapshot_json,
            created_by_membership_id,
            created_at
          )
          VALUES (
            ${seed.versionId}::uuid,
            ${tenant.tenantId}::uuid,
            1,
            ${JSON.stringify({ tenantId: tenant.tenantId, displayName: seed.displayName })}::jsonb,
            ${tenant.membershipId}::uuid,
            now()
          )
        `;
      }
    },
  );

  return { tenantA: tenantASeed, tenantB: tenantBSeed };
}

const tenantAContext = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const tenantBContext = {
  tenantId: "018f0000-0000-7000-8000-000000000002",
  tenantSlug: "tenant-b",
  tenantState: "ACTIVE" as const,
};

const tenantABranding = {
  data: {
    tenantId: tenantAContext.tenantId,
    displayName: "Tenant A Branding",
    publicName: "Tenant A Academy",
    logoLight: null,
    logoDark: null,
    favicon: null,
    issuerName: "Tenant A Issuer",
    publicLandingCopy: null,
    status: "DRAFT" as const,
    version: 0,
    updatedAt: "2025-01-01T00:00:00.000Z",
    publishedAt: null,
  },
};

const tenantADomains = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000020",
      hostname: "tenant-a.example.com",
      type: "ATLAS_SUBDOMAIN" as const,
      status: "ACTIVE" as const,
      isPrimary: true,
      verificationTxtName: null,
      verificationTxtValue: null,
      failureReason: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

const tenantAVersions = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000030",
      version: 1,
      snapshot: { tenantId: tenantAContext.tenantId, publicName: "Tenant A Academy" },
      publishedByMembershipId: "018f0000-0000-7000-8000-000000000010",
      publishedAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

const tenantBDomains = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000099",
      hostname: "tenant-b.example.com",
      type: "ATLAS_SUBDOMAIN" as const,
      status: "ACTIVE" as const,
      isPrimary: true,
      verificationTxtName: null,
      verificationTxtValue: null,
      failureReason: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

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

function setupTenantAApiMocks() {
  mockResolveTenant.mockResolvedValue(tenantAContext);
  mockRequireSupabaseUser.mockResolvedValue({
    supabaseUserId: "018f0000-0000-7000-8000-000000000001",
    email: "admin@tenant-a.example.com",
    mfaEnabled: false,
  });
  mockUpsertAuthPrincipal.mockResolvedValue({
    id: "018f0000-0000-7000-8000-000000000098",
    email: "admin@tenant-a.example.com",
  });
  mockRequireActiveMembership.mockResolvedValue({
    membershipId: "018f0000-0000-7000-8000-000000000010",
    status: "ACTIVE",
  });
  mockCan.mockResolvedValue({
    allowed: true,
    permission: "branding.read",
    reason: "ALLOWED",
    matchedRoleKeys: ["admin"],
    bypassedResourcePredicate: true,
  });
  mockReadTenantBranding.mockResolvedValue(tenantABranding);
  mockReadTenantDomains.mockResolvedValue(tenantADomains);
  mockReadTenantBrandingVersions.mockResolvedValue(tenantAVersions);
}

describeWithDb("branding and domain tenant isolation (database)", () => {
  it("lets tenant A see only tenant A branding, theme, and domains", async () => {
    const fixture = await createTenantIsolationFixture();
    const seed = await seedBrandingDomainFixture(fixture.tenantA, fixture.tenantB);

    const branding = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; display_name: string }>>`
        SELECT tenant_id::text, display_name
        FROM tenant_branding
        ORDER BY display_name ASC
      `;
    });

    expect(branding).toHaveLength(1);
    expect(branding[0]).toMatchObject({
      tenant_id: fixture.tenantA.tenantId,
      display_name: seed.tenantA.displayName,
    });

    const themes = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; primary_color: string }>>`
        SELECT tenant_id::text, primary_color
        FROM tenant_theme
        ORDER BY primary_color ASC
      `;
    });

    expect(themes).toHaveLength(1);
    expect(themes[0]).toMatchObject({
      tenant_id: fixture.tenantA.tenantId,
      primary_color: seed.tenantA.primaryColor,
    });

    const domains = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; hostname: string }>>`
        SELECT tenant_id::text, hostname
        FROM tenant_domains
        WHERE deleted_at IS NULL
        ORDER BY hostname ASC
      `;
    });

    expect(domains).toHaveLength(1);
    expect(domains[0]).toMatchObject({
      tenant_id: fixture.tenantA.tenantId,
      hostname: seed.tenantA.hostname,
    });
  });

  it("lets tenant B see only tenant B branding, theme, and domains", async () => {
    const fixture = await createTenantIsolationFixture();
    const seed = await seedBrandingDomainFixture(fixture.tenantA, fixture.tenantB);

    const branding = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; display_name: string }>>`
        SELECT tenant_id::text, display_name
        FROM tenant_branding
        ORDER BY display_name ASC
      `;
    });

    expect(branding).toHaveLength(1);
    expect(branding[0]).toMatchObject({
      tenant_id: fixture.tenantB.tenantId,
      display_name: seed.tenantB.displayName,
    });

    const themes = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; primary_color: string }>>`
        SELECT tenant_id::text, primary_color
        FROM tenant_theme
        ORDER BY primary_color ASC
      `;
    });

    expect(themes).toHaveLength(1);
    expect(themes[0]).toMatchObject({
      tenant_id: fixture.tenantB.tenantId,
      primary_color: seed.tenantB.primaryColor,
    });

    const domains = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ tenant_id: string; hostname: string }>>`
        SELECT tenant_id::text, hostname
        FROM tenant_domains
        WHERE deleted_at IS NULL
        ORDER BY hostname ASC
      `;
    });

    expect(domains).toHaveLength(1);
    expect(domains[0]).toMatchObject({
      tenant_id: fixture.tenantB.tenantId,
      hostname: seed.tenantB.hostname,
    });
  });

  it("does not expose tenant B branding version rows to tenant A", async () => {
    const fixture = await createTenantIsolationFixture();
    const seed = await seedBrandingDomainFixture(fixture.tenantA, fixture.tenantB);

    const versions = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return tx.$queryRaw<Array<{ id: string; tenant_id: string }>>`
        SELECT id::text, tenant_id::text
        FROM tenant_branding_version
        ORDER BY version ASC
      `;
    });

    expect(versions).toHaveLength(1);
    expect(versions[0]?.id).toBe(seed.tenantA.versionId);
    expect(versions.some((row) => row.id === seed.tenantB.versionId)).toBe(false);
  });

  it("cannot delete tenant B domain from tenant A context", async () => {
    const fixture = await createTenantIsolationFixture();
    const seed = await seedBrandingDomainFixture(fixture.tenantA, fixture.tenantB);

    const disabled = await realWithTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      return disableTenantDomain(tx, seed.tenantB.domainId);
    });

    expect(disabled).toBeNull();

    const tenantBDomain = await realWithTenantTx(tenantCtx(fixture.tenantB), async (tx) => {
      return tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id::text, status::text
        FROM tenant_domains
        WHERE id = ${seed.tenantB.domainId}::uuid
      `;
    });

    expect(tenantBDomain).toHaveLength(1);
    expect(tenantBDomain[0]?.status).toBe("ACTIVE");
  });
});

describe("branding and domain tenant isolation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setupTenantAApiMocks();
    mockDeleteTenantDomain.mockRejectedValue(new Error("DOMAIN_NOT_FOUND"));
  });

  it("host wins over token and client tenant headers before route handling", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          tenant_id: tenantAContext.tenantId,
          tenant_slug: tenantAContext.tenantSlug,
          tenant_state: "ACTIVE",
          domain_id: "tenant-a-domain-id",
          domain_status: "ACTIVE",
          hostname: "tenant-a.example.com",
        },
      ]),
    };

    const resolved = await resolveTenantFromRequest({
      req: createTenantHostRequest(
        "tenant-a.example.com",
        "/api/v1/branding",
        tenantBContext.tenantId,
      ),
      db,
    });

    expect(resolved.tenantId).toBe(tenantAContext.tenantId);
    expect(resolved.tenantSlug).toBe(tenantAContext.tenantSlug);
  });

  it("rejects guessed tenant B tenant_id and keeps tenant A scope on GET /branding", async () => {
    const rejected = await getBranding(
      createTenantHostRequest(
        "tenant-a.example.com",
        "/api/v1/branding?tenant_id=018f0000-0000-7000-8000-000000000002",
        tenantBContext.tenantId,
      ),
    );
    const rejectedBody = (await rejected.json()) as { error: { code: string } };

    expect(rejected.status).toBe(400);
    expect(rejectedBody.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();

    mockWithTenantTx.mockClear();

    const allowed = await getBranding(
      new NextRequest("https://tenant-a.example.com/api/v1/branding", {
        headers: {
          host: "tenant-a.example.com",
          authorization: "Bearer access-token",
        },
      }),
    );
    const allowedBody: unknown = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual(tenantABranding);
    expect(mockReadTenantBranding).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(allowedBody)).not.toContain(tenantBContext.tenantId);
  });

  it("rejects guessed tenant B tenant_id and keeps tenant A scope on GET /domains", async () => {
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "tenancy.domain.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });

    const rejected = await getDomains(
      createTenantHostRequest(
        "tenant-a.example.com",
        "/api/v1/domains?tenant_id=018f0000-0000-7000-8000-000000000002",
        tenantBContext.tenantId,
      ),
    );
    const rejectedBody = (await rejected.json()) as { error: { code: string } };

    expect(rejected.status).toBe(400);
    expect(rejectedBody.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();

    mockWithTenantTx.mockClear();

    const allowed = await getDomains(
      createTenantHostRequest("tenant-a.example.com", "/api/v1/domains", tenantBContext.tenantId),
    );
    const allowedBody: unknown = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(allowedBody).toEqual(tenantADomains);
    expect(JSON.stringify(allowedBody)).not.toContain(tenantBDomains.data[0].hostname);
  });

  it("does not expose tenant B branding version rows through tenant A GET /branding/versions", async () => {
    const rejected = await getBrandingVersions(
      createTenantHostRequest(
        "tenant-a.example.com",
        "/api/v1/branding/versions?tenant_id=018f0000-0000-7000-8000-000000000002",
        tenantBContext.tenantId,
      ),
    );
    const rejectedBody = (await rejected.json()) as { error: { code: string } };

    expect(rejected.status).toBe(400);
    expect(rejectedBody.error.code).toBe("VALIDATION_ERROR");

    mockWithTenantTx.mockClear();

    const allowed = await getBrandingVersions(
      new NextRequest("https://tenant-a.example.com/api/v1/branding/versions", {
        headers: {
          host: "tenant-a.example.com",
          authorization: "Bearer access-token",
        },
      }),
    );
    const allowedBody = (await allowed.json()) as typeof tenantAVersions;

    expect(allowed.status).toBe(200);
    expect(allowedBody.data.every((row) => row.id !== tenantBDomains.data[0].id)).toBe(true);
    expect(JSON.stringify(allowedBody)).not.toContain(tenantBContext.tenantId);
  });

  it("cannot delete tenant B domain from tenant A host context", async () => {
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "tenancy.domain.manage",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });

    const response = await deleteDomain(
      new NextRequest(`https://tenant-a.example.com/api/v1/domains/${tenantBDomains.data[0].id}`, {
        method: "DELETE",
        headers: {
          host: "tenant-a.example.com",
          authorization: "Bearer token-with-tenant-b-claim",
          "x-tenant-id": tenantBContext.tenantId,
          "idempotency-key": "domain-delete-isolation-key",
        },
      }),
      { params: Promise.resolve({ id: tenantBDomains.data[0].id }) },
    );

    expect(response.status).not.toBe(200);
    expect(mockDeleteTenantDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: tenantAContext.tenantId,
      }),
      tenantBDomains.data[0].id,
    );
  });
});
