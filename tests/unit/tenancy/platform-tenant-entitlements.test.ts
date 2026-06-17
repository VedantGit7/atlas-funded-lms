import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformTx } from "@atlas/db";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const platformPrincipalId = "018f0000-0000-7000-8000-000000000003";
const requestId = "req_tenant_entitlements_test";
const reason = "Updating tenant entitlements for rollout";

const { auditWriterWriteMock, outboxPublishMock } = vi.hoisted(() => ({
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
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

import {
  readPlatformTenantEntitlements,
  replacePlatformTenantEntitlements,
} from "@atlas/domain-tenancy/services/platform-tenant-entitlement.service";

const queryRawMock = vi.fn();
const executeRawMock = vi.fn();
const tx = {
  $queryRaw: queryRawMock,
  $executeRaw: executeRawMock,
} as unknown as PlatformTx;

describe("platform tenant entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditWriterWriteMock.mockResolvedValue(undefined);
    outboxPublishMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  it("returns tenant entitlement rows on GET service read", async () => {
    queryRawMock.mockResolvedValueOnce([
      {
        key: "feature.community",
        enabled: true,
        value_json: { tier: "standard" },
        expires_at: null,
      },
    ]);

    const result = await readPlatformTenantEntitlements(tx, tenantId);

    expect(result).toEqual({
      data: [
        {
          key: "feature.community",
          enabled: true,
          value: { tier: "standard" },
          expiresAt: null,
        },
      ],
    });
  });

  it("upserts approved entitlement keys on PUT and writes audit plus entitlement.changed", async () => {
    queryRawMock.mockResolvedValueOnce([]);
    executeRawMock.mockResolvedValue(1);
    queryRawMock.mockResolvedValueOnce([
      {
        key: "feature.community",
        enabled: true,
        value_json: null,
        expires_at: null,
      },
    ]);

    const result = await replacePlatformTenantEntitlements(
      tx,
      {
        tenantId,
        platformPrincipalId,
        requestId,
        reason,
      },
      {
        reason: "Updating tenant entitlements for rollout",
        entitlements: [
          {
            key: "feature.community",
            enabled: true,
            value: null,
            expiresAt: null,
          },
        ],
      },
    );

    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(1);
    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        platformPrincipalId,
        requestId,
      }),
      expect.objectContaining({
        action: "config.entitlement.changed",
      }),
    );
    expect(outboxPublishMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "entitlement.changed",
        payload: expect.objectContaining({
          tenantId,
          key: "feature.community",
        }),
      }),
    );
  });

  it("does not expose a tenant admin route for platform entitlement management", () => {
    const routeSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../apps/web/src/app/api/v1/platform/tenants/[id]/entitlements/route.ts",
      ),
      "utf8",
    );
    const metadataSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../apps/web/src/app/api/v1/platform/tenants/[id]/entitlements/route.metadata.ts",
      ),
      "utf8",
    );

    expect(routeSource).toContain("createPlatformRoute");
    expect(metadataSource).toContain("platform.entitlement.manage");
    expect(routeSource).not.toContain("createTenantRoute");
    expect(routeSource).not.toContain("requireActiveMembership");
  });
});
