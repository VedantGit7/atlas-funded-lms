import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import type * as DomainAdminModule from "@atlas/domain-branding/services/domain-admin.service";

const findActiveEntitlementByKeyMock = vi.fn();
const canMock = vi.fn();
const findDomainByHostnameMock = vi.fn();
const insertTenantDomainMock = vi.fn();

vi.mock("@atlas/domain-config", () => ({
  findActiveEntitlementByKey: (...args: unknown[]) => findActiveEntitlementByKeyMock(...args),
}));

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => canMock(...args),
  };
});

vi.mock("@atlas/domain-branding/repositories/domain.repository", () => ({
  findDomainByHostname: (...args: unknown[]) => findDomainByHostnameMock(...args),
  insertTenantDomain: (...args: unknown[]) => insertTenantDomainMock(...args),
  listTenantDomains: vi.fn(),
  disableTenantDomain: vi.fn(),
}));

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@atlas/events", () => ({
  outbox: { publish: vi.fn().mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" }) },
}));

import { runProtectedTenantRoutePipeline } from "@atlas/api/create-tenant-route";
import { EntitlementRequiredError } from "@atlas/authorization";
import {
  routeMetadata as getBrandingRouteMetadata,
  putRouteMetadata as putBrandingRouteMetadata,
} from "../../apps/web/src/app/api/v1/branding/route.metadata";
import { routeMetadata as publishBrandingRouteMetadata } from "../../apps/web/src/app/api/v1/branding/publish/route.metadata";
import { routeMetadata as putThemeRouteMetadata } from "../../apps/web/src/app/api/v1/theme/route.metadata";
import {
  getRouteMetadata as getDomainsRouteMetadata,
  postRouteMetadata as postDomainsRouteMetadata,
} from "../../apps/web/src/app/api/v1/domains/route.metadata";
import { routeMetadata as deleteDomainRouteMetadata } from "../../apps/web/src/app/api/v1/domains/[id]/route.metadata";

async function getRealCreateTenantDomain() {
  const mod = await vi.importActual<typeof DomainAdminModule>(
    "@atlas/domain-branding/services/domain-admin.service",
  );
  return mod.createTenantDomain;
}

const routePermissionCases = [
  ["GET /branding", getBrandingRouteMetadata, "branding.read"],
  ["PUT /branding", putBrandingRouteMetadata, "branding.update"],
  ["PUT /theme", putThemeRouteMetadata, "branding.update"],
  ["POST /branding/publish", publishBrandingRouteMetadata, "branding.publish"],
  ["GET /domains", getDomainsRouteMetadata, "tenancy.domain.read"],
  ["POST /domains", postDomainsRouteMetadata, "tenancy.domain.manage"],
  ["DELETE /domains/[id]", deleteDomainRouteMetadata, "tenancy.domain.manage"],
] as const;

describe("branding and domain route permissions", () => {
  it.each(routePermissionCases)("%s requires %s", (_route, metadata, permission) => {
    expect(metadata.permission).toBe(permission);
  });
});

describe("custom domain entitlement gating", () => {
  beforeEach(() => {
    findActiveEntitlementByKeyMock.mockReset();
    canMock.mockReset();
    findDomainByHostnameMock.mockReset();
    insertTenantDomainMock.mockReset();
    findDomainByHostnameMock.mockResolvedValue(null);
  });

  it("enforces branding.custom_domain.enable before persisting a custom domain", async () => {
    const callOrder: string[] = [];

    findActiveEntitlementByKeyMock.mockImplementation(async () => {
      callOrder.push("entitlement");
      return null;
    });
    findDomainByHostnameMock.mockImplementation(async () => {
      callOrder.push("findDomain");
      return null;
    });
    insertTenantDomainMock.mockImplementation(async () => {
      callOrder.push("insert");
      return { id: "018f0000-0000-7000-8000-000000000020" };
    });

    const createDomain = await getRealCreateTenantDomain();
    const tx = { $queryRaw: vi.fn() } as unknown as TenantTx;
    const ctx = {
      tenantId: "018f0000-0000-7000-8000-000000000001",
      actorMembershipId: "018f0000-0000-7000-8000-000000000010",
      requestId: "req_custom_domain_entitlement",
    };

    await expect(
      createDomain(tx, ctx, {
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        makePrimary: false,
      }),
    ).rejects.toBeInstanceOf(EntitlementRequiredError);

    expect(callOrder).toEqual(["entitlement"]);
    expect(insertTenantDomainMock).not.toHaveBeenCalled();
  });

  it("returns ENTITLEMENT_REQUIRED before can() when route metadata declares the entitlement", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    let error: unknown;

    try {
      await runProtectedTenantRoutePipeline({
        tx: { $queryRaw: vi.fn() } as unknown as TenantTx,
        ctx: {
          tenantId: "018f0000-0000-7000-8000-000000000001",
          requestId: "req_route_entitlement",
          actorMembershipId: "018f0000-0000-7000-8000-000000000010",
        },
        metadata: {
          permission: "tenancy.domain.manage",
          entitlement: "branding.custom_domain.enable",
          rateLimit: "tenantMutation",
          audit: "required",
          idempotency: "required",
        },
        params: {},
        input: undefined,
      });
      expect.unreachable("expected entitlement enforcement to fail");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(EntitlementRequiredError);
    expect(canMock).not.toHaveBeenCalled();
  });

  it("does not require custom-domain entitlement for atlas subdomains", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValue(null);
    insertTenantDomainMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000030",
      hostname: "tenant-a.localhost.test",
      type: "ATLAS_SUBDOMAIN",
      status: "ACTIVE",
      is_primary: true,
      verification_txt_name: null,
      verification_txt_value: null,
      failure_reason: null,
      created_at: new Date("2025-01-01T00:00:00.000Z"),
      updated_at: new Date("2025-01-01T00:00:00.000Z"),
    });

    const createDomain = await getRealCreateTenantDomain();
    const tx = { $queryRaw: vi.fn() } as unknown as TenantTx;

    await createDomain(
      tx,
      {
        tenantId: "018f0000-0000-7000-8000-000000000001",
        actorMembershipId: "018f0000-0000-7000-8000-000000000010",
        requestId: "req_atlas_subdomain",
      },
      {
        hostname: "tenant-a.localhost.test",
        type: "ATLAS_SUBDOMAIN",
        makePrimary: true,
      },
    );

    expect(findActiveEntitlementByKeyMock).not.toHaveBeenCalled();
    expect(insertTenantDomainMock).toHaveBeenCalledTimes(1);
  });

  it("keeps POST /domains route metadata entitlement null so atlas subdomains stay ungated", () => {
    expect(postDomainsRouteMetadata.entitlement).toBeNull();
  });
});
