import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformTx } from "@atlas/db";
import { ProvisionTenantRequestSchema } from "@atlas/domain-tenancy/schemas/platform-tenants";
import { postRouteMetadata } from "../../../backend/apps/api/src/app/api/v1/platform/tenants/route.metadata";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const jobId = "018f0000-0000-7000-8000-000000000002";
const platformPrincipalId = "018f0000-0000-7000-8000-000000000003";
const requestId = "req_provision_tenant_test";
const idempotencyKey = "idem_provision_tenant_test";

const {
  findTenantBySlugMock,
  findTenantIdByProvisioningIdempotencyKeyMock,
  insertProvisioningTenantMock,
  insertProvisioningJobMock,
  updateProvisioningJobStatusMock,
  insertFallbackTenantDomainMock,
  updateTenantStateMock,
  grantPlatformTenantEntitlementsMock,
  readPlatformTenantDetailMock,
  seedTenantSystemRolesFromCatalogueMock,
  seedOwnerInvitationFromExistingHelperMock,
  seedTenantWorkflowDefinitionsFromCatalogueMock,
  auditWriterWriteMock,
  outboxPublishMock,
} = vi.hoisted(() => ({
  findTenantBySlugMock: vi.fn(),
  findTenantIdByProvisioningIdempotencyKeyMock: vi.fn(),
  insertProvisioningTenantMock: vi.fn(),
  insertProvisioningJobMock: vi.fn(),
  updateProvisioningJobStatusMock: vi.fn(),
  grantPlatformTenantEntitlementsMock: vi.fn(),
  insertFallbackTenantDomainMock: vi.fn(),
  updateTenantStateMock: vi.fn(),
  readPlatformTenantDetailMock: vi.fn(),
  seedTenantSystemRolesFromCatalogueMock: vi.fn(),
  seedOwnerInvitationFromExistingHelperMock: vi.fn(),
  seedTenantWorkflowDefinitionsFromCatalogueMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
}));

vi.mock("@atlas/domain-tenancy/repositories/platform-tenant.repository", () => ({
  findTenantBySlug: (...args: unknown[]) => findTenantBySlugMock(...args),
  insertProvisioningTenant: (...args: unknown[]) => insertProvisioningTenantMock(...args),
  updateTenantState: (...args: unknown[]) => updateTenantStateMock(...args),
}));

vi.mock("@atlas/domain-tenancy/repositories/provisioning-job.repository", () => ({
  insertProvisioningJob: (...args: unknown[]) => insertProvisioningJobMock(...args),
  updateProvisioningJobStatus: (...args: unknown[]) => updateProvisioningJobStatusMock(...args),
  findTenantIdByProvisioningIdempotencyKey: (...args: unknown[]) =>
    findTenantIdByProvisioningIdempotencyKeyMock(...args),
}));

vi.mock("@atlas/domain-tenancy/repositories/platform-tenant-domain.repository", () => ({
  insertFallbackTenantDomain: (...args: unknown[]) => insertFallbackTenantDomainMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-entitlement.service", () => ({
  grantPlatformTenantEntitlements: (...args: unknown[]) =>
    grantPlatformTenantEntitlementsMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-read.service", () => ({
  readPlatformTenantDetail: (...args: unknown[]) => readPlatformTenantDetailMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-provisioning.helpers", () => ({
  seedTenantSystemRolesFromCatalogue: (...args: unknown[]) =>
    seedTenantSystemRolesFromCatalogueMock(...args),
  seedOwnerInvitationFromExistingHelper: (...args: unknown[]) =>
    seedOwnerInvitationFromExistingHelperMock(...args),
  seedTenantWorkflowDefinitionsFromCatalogue: (...args: unknown[]) =>
    seedTenantWorkflowDefinitionsFromCatalogueMock(...args),
}));

vi.mock("@atlas/audit", () => ({
  auditWriter: {
    write: (...args: unknown[]) => auditWriterWriteMock(...args),
  },
}));

vi.mock("@atlas/events", () => ({
  outbox: {
    publish: (...args: unknown[]) => outboxPublishMock(...args),
  },
}));

import { provisionTenant } from "@atlas/domain-tenancy/services/platform-tenant-provisioning.service";

const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as PlatformTx;

const validInput = {
  slug: "acme-learning",
  displayName: "Acme Learning",
  owner: {
    email: "owner@acme.example.com",
    displayName: "Acme Owner",
  },
  initialEntitlements: [
    {
      key: "feature.community",
      enabled: true,
      value: null,
      expiresAt: null,
    },
  ],
};

const tenantDetail = {
  data: {
    id: tenantId,
    slug: validInput.slug,
    displayName: validInput.displayName,
    legalName: null,
    state: "ACTIVE",
    defaultLocale: "en",
    defaultTimezone: "UTC",
    primaryDomain: {
      id: "018f0000-0000-7000-8000-000000000010",
      hostname: "acme-learning.localhost.test",
      status: "ACTIVE",
      type: "atlas_subdomain",
    },
    provisioning: {
      latestJobId: jobId,
      latestStatus: "SUCCEEDED",
    },
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
};

const ctx = {
  platformPrincipalId,
  requestId,
  reason: "Provisioning a new tenant for onboarding",
  idempotencyKey,
  tenantBaseDomain: "localhost.test",
};

describe("platform tenant provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findTenantIdByProvisioningIdempotencyKeyMock.mockResolvedValue(null);
    findTenantBySlugMock.mockResolvedValue(null);
    insertProvisioningTenantMock.mockResolvedValue({ id: tenantId });
    insertProvisioningJobMock.mockResolvedValue({ id: jobId });
    updateProvisioningJobStatusMock.mockResolvedValue(undefined);
    insertFallbackTenantDomainMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000011",
    });
    updateTenantStateMock.mockResolvedValue({
      id: tenantId,
      previous_state: "PROVISIONING",
      state: "ACTIVE",
    });
    readPlatformTenantDetailMock.mockResolvedValue(tenantDetail);
  });

  it("validates slug format and rejects invalid owner emails", () => {
    expect(() =>
      ProvisionTenantRequestSchema.parse({
        ...validInput,
        slug: "Invalid Slug!",
      }),
    ).toThrow();

    expect(() =>
      ProvisionTenantRequestSchema.parse({
        ...validInput,
        owner: {
          ...validInput.owner,
          email: "not-an-email",
        },
      }),
    ).toThrow();
  });

  it("requires idempotency key at the route layer", () => {
    expect(postRouteMetadata.idempotency).toBe("required");
  });

  it("returns the existing tenant when the idempotency key was already used", async () => {
    findTenantIdByProvisioningIdempotencyKeyMock.mockResolvedValue(tenantId);

    const result = await provisionTenant(tx, ctx, validInput);

    expect(result).toEqual(tenantDetail);
    expect(findTenantBySlugMock).not.toHaveBeenCalled();
    expect(insertProvisioningTenantMock).not.toHaveBeenCalled();
    expect(readPlatformTenantDetailMock).toHaveBeenCalledWith(tx, tenantId);
  });

  it("creates tenant in PROVISIONING and moves to ACTIVE after successful provisioning", async () => {
    await provisionTenant(tx, ctx, validInput);

    expect(insertProvisioningTenantMock).toHaveBeenCalledTimes(1);
    expect(updateTenantStateMock).toHaveBeenCalledWith(tx, {
      tenantId,
      from: ["PROVISIONING"],
      to: "ACTIVE",
    });
    expect(updateProvisioningJobStatusMock).toHaveBeenNthCalledWith(1, tx, {
      jobId,
      status: "RUNNING",
      step: "seeding.foundation",
    });
    expect(updateProvisioningJobStatusMock).toHaveBeenNthCalledWith(2, tx, {
      jobId,
      status: "SUCCEEDED",
      step: "tenant.active",
    });
  });

  it("creates provisioning job and fallback atlas_subdomain tenant domain", async () => {
    await provisionTenant(tx, ctx, validInput);

    expect(insertProvisioningJobMock).toHaveBeenCalledWith(tx, {
      tenantId,
      idempotencyKey,
      status: "QUEUED",
      step: "tenant.created",
    });
    expect(insertFallbackTenantDomainMock).toHaveBeenCalledWith(tx, {
      tenantId,
      hostname: "acme-learning.localhost.test",
    });
  });

  it("calls tenant role seed and owner invitation helpers", async () => {
    await provisionTenant(tx, ctx, validInput);

    expect(seedTenantSystemRolesFromCatalogueMock).toHaveBeenCalledWith(tx, { tenantId });
    expect(seedTenantWorkflowDefinitionsFromCatalogueMock).toHaveBeenCalledWith(tx, {
      tenantId,
    });
    expect(seedOwnerInvitationFromExistingHelperMock).toHaveBeenCalledWith(tx, {
      tenantId,
      email: validInput.owner.email,
      displayName: validInput.owner.displayName,
      requestId,
    });
  });

  it("grants initial entitlements", async () => {
    await provisionTenant(tx, ctx, validInput);

    expect(grantPlatformTenantEntitlementsMock).toHaveBeenCalledWith(tx, {
      tenantId,
      platformPrincipalId,
      requestId,
      reason: ctx.reason,
      entitlements: [
        {
          key: "feature.community",
          enabled: true,
          value: null,
          expiresAt: null,
        },
      ],
    });
  });

  it("writes audit entries and publishes tenant.created and tenant.state_changed events", async () => {
    await provisionTenant(tx, ctx, validInput);

    expect(auditWriterWriteMock).toHaveBeenCalledTimes(2);
    expect(auditWriterWriteMock).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        tenantId,
        platformPrincipalId,
        requestId,
      }),
      expect.objectContaining({
        action: "tenant.created",
      }),
    );
    expect(auditWriterWriteMock).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({
        tenantId,
        platformPrincipalId,
        requestId,
      }),
      expect.objectContaining({
        action: "tenant.state_changed",
        before: { state: "PROVISIONING" },
        after: { state: "ACTIVE" },
      }),
    );

    expect(outboxPublishMock).toHaveBeenCalledTimes(2);
    expect(outboxPublishMock).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        eventType: "tenant.created",
        idempotencyKey,
      }),
    );
    expect(outboxPublishMock).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({
        eventType: "tenant.state_changed",
        idempotencyKey: `${idempotencyKey}:active`,
      }),
    );
  });

  it("does not hardcode tenant-specific branding slugs in provisioning sources", () => {
    const blockedTenantSlug = ["funded", "beyond"].join("");
    const serviceSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/tenancy/src/services/platform-tenant-provisioning.service.ts",
      ),
      "utf8",
    );
    const helpersSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/tenancy/src/services/platform-tenant-provisioning.helpers.ts",
      ),
      "utf8",
    );

    expect(serviceSource.toLowerCase()).not.toContain(blockedTenantSlug);
    expect(helpersSource.toLowerCase()).not.toContain(blockedTenantSlug);
  });
});
