import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformTx } from "@atlas/db";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const platformPrincipalId = "018f0000-0000-7000-8000-000000000003";
const requestId = "req_tenant_lifecycle_test";
const reason = "Lifecycle transition for compliance review";

const {
  updateTenantStateMock,
  readPlatformTenantDetailMock,
  auditWriterWriteMock,
  outboxPublishMock,
} = vi.hoisted(() => ({
  updateTenantStateMock: vi.fn(),
  readPlatformTenantDetailMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
}));

vi.mock("@atlas/domain-tenancy/repositories/platform-tenant.repository", () => ({
  updateTenantState: (...args: unknown[]) => updateTenantStateMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-read.service", () => ({
  readPlatformTenantDetail: (...args: unknown[]) => readPlatformTenantDetailMock(...args),
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
  archiveTenant,
  resumeTenant,
  suspendTenant,
} from "@atlas/domain-tenancy/services/platform-tenant-lifecycle.service";

const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as PlatformTx;

const ctx = {
  platformPrincipalId,
  requestId,
  reason,
};

const tenantDetail = {
  data: {
    id: tenantId,
    slug: "acme-learning",
    displayName: "Acme Learning",
    legalName: null,
    state: "ACTIVE",
    defaultLocale: "en",
    defaultTimezone: "UTC",
    primaryDomain: null,
    provisioning: {
      latestJobId: null,
      latestStatus: null,
    },
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
};

describe("platform tenant lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readPlatformTenantDetailMock.mockResolvedValue(tenantDetail);
    auditWriterWriteMock.mockResolvedValue(undefined);
    outboxPublishMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  it("transitions ACTIVE to SUSPENDED", async () => {
    updateTenantStateMock.mockResolvedValueOnce({
      id: tenantId,
      previous_state: "ACTIVE",
      state: "SUSPENDED",
    });

    await suspendTenant(tx, ctx, tenantId);

    expect(updateTenantStateMock).toHaveBeenCalledWith(tx, {
      tenantId,
      from: ["ACTIVE"],
      to: "SUSPENDED",
    });
    expectAuditAndOutbox("ACTIVE", "SUSPENDED");
  });

  it("transitions SUSPENDED to ACTIVE", async () => {
    updateTenantStateMock.mockResolvedValueOnce({
      id: tenantId,
      previous_state: "SUSPENDED",
      state: "ACTIVE",
    });

    await resumeTenant(tx, ctx, tenantId);

    expect(updateTenantStateMock).toHaveBeenCalledWith(tx, {
      tenantId,
      from: ["SUSPENDED"],
      to: "ACTIVE",
    });
    expectAuditAndOutbox("SUSPENDED", "ACTIVE");
  });

  it("transitions ACTIVE or SUSPENDED to ARCHIVED", async () => {
    updateTenantStateMock.mockResolvedValueOnce({
      id: tenantId,
      previous_state: "SUSPENDED",
      state: "ARCHIVED",
    });

    await archiveTenant(tx, ctx, tenantId);

    expect(updateTenantStateMock).toHaveBeenCalledWith(tx, {
      tenantId,
      from: ["ACTIVE", "SUSPENDED"],
      to: "ARCHIVED",
    });
    expectAuditAndOutbox("SUSPENDED", "ARCHIVED");
  });

  it("rejects invalid transitions", async () => {
    updateTenantStateMock.mockRejectedValueOnce(new Error("INVALID_TENANT_STATE_TRANSITION"));

    await expect(suspendTenant(tx, ctx, tenantId)).rejects.toThrow(
      "INVALID_TENANT_STATE_TRANSITION",
    );
    expect(auditWriterWriteMock).not.toHaveBeenCalled();
    expect(outboxPublishMock).not.toHaveBeenCalled();
  });

  function expectAuditAndOutbox(from: string, to: string) {
    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        platformPrincipalId,
        requestId,
      }),
      expect.objectContaining({
        action: "tenant.state_changed",
        before: { state: from },
        after: { state: to },
        reason,
      }),
    );

    expect(outboxPublishMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "tenant.state_changed",
        payload: {
          tenantId,
          from,
          to,
        },
        idempotencyKey: `${requestId}:${tenantId}:${to}`,
      }),
    );
  }
});
