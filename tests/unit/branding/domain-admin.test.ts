import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000002";
const domainId = "018f0000-0000-7000-8000-000000000010";
const requestId = "req_domain_admin_test";

const {
  listTenantDomainsMock,
  findDomainByHostnameMock,
  insertTenantDomainMock,
  disableTenantDomainMock,
  auditWriterWriteMock,
  outboxPublishMock,
  findActiveEntitlementByKeyMock,
} = vi.hoisted(() => ({
  listTenantDomainsMock: vi.fn(),
  findDomainByHostnameMock: vi.fn(),
  insertTenantDomainMock: vi.fn(),
  disableTenantDomainMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
  findActiveEntitlementByKeyMock: vi.fn(),
}));

vi.mock("@atlas/domain-config", () => ({
  findActiveEntitlementByKey: (...args: unknown[]) => findActiveEntitlementByKeyMock(...args),
}));

vi.mock("@atlas/domain-branding/repositories/domain.repository", () => ({
  listTenantDomains: (...args: unknown[]) => listTenantDomainsMock(...args),
  findDomainByHostname: (...args: unknown[]) => findDomainByHostnameMock(...args),
  insertTenantDomain: (...args: unknown[]) => insertTenantDomainMock(...args),
  disableTenantDomain: (...args: unknown[]) => disableTenantDomainMock(...args),
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
  createTenantDomain,
  deleteTenantDomain,
  readTenantDomains,
} from "@atlas/domain-branding/services/domain-admin.service";

const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as Parameters<
  typeof readTenantDomains
>[0];

const ctx = {
  tenantId,
  actorMembershipId,
  requestId,
};

const domainRow = {
  id: domainId,
  hostname: "learn.example.com",
  type: "CUSTOM_DOMAIN",
  status: "PENDING",
  is_primary: false,
  verification_txt_name: "_atlas-verify.learn.example.com",
  verification_txt_value: "atlas=0123456789abcdef0123456789abcdef0123456789abcdef",
  failure_reason: null,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
};

describe("domain admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTenantDomainsMock.mockResolvedValue([domainRow]);
    findDomainByHostnameMock.mockResolvedValue(null);
    insertTenantDomainMock.mockResolvedValue(domainRow);
    disableTenantDomainMock.mockResolvedValue({ id: domainId, status: "DISABLED" });
    auditWriterWriteMock.mockResolvedValue(undefined);
    outboxPublishMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
    findActiveEntitlementByKeyMock.mockResolvedValue({
      key: "branding.custom_domain.enable",
      enabled: true,
    });
  });

  it("lists tenant domains", async () => {
    const result = await readTenantDomains(tx);

    expect(listTenantDomainsMock).toHaveBeenCalledWith(tx);
    expect(result.data).toEqual([
      expect.objectContaining({
        id: domainId,
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        status: "PENDING",
      }),
    ]);
  });

  it("creates custom domains in PENDING with verification TXT records", async () => {
    const result = await createTenantDomain(tx, ctx, {
      hostname: "learn.example.com",
      type: "CUSTOM_DOMAIN",
      makePrimary: false,
    });

    expect(insertTenantDomainMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        verificationTxtName: "_atlas-verify.learn.example.com",
        verificationTxtValue: expect.stringMatching(/^atlas=[0-9a-f]{48}$/),
      }),
    );
    expect(result.data.status).toBe("PENDING");
    expect(result.data.verificationTxtName).toBe("_atlas-verify.learn.example.com");
    expect(result.data.verificationTxtValue).toMatch(/^atlas=/);
  });

  it("blocks duplicate hostnames", async () => {
    findDomainByHostnameMock.mockResolvedValueOnce({ id: domainId, hostname: "learn.example.com" });

    await expect(
      createTenantDomain(tx, ctx, {
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        makePrimary: false,
      }),
    ).rejects.toThrow("DOMAIN_ALREADY_EXISTS");

    expect(insertTenantDomainMock).not.toHaveBeenCalled();
  });

  it("soft-deletes domains by disabling them", async () => {
    const result = await deleteTenantDomain(tx, ctx, domainId);

    expect(disableTenantDomainMock).toHaveBeenCalledWith(tx, domainId);
    expect(result.data).toEqual({
      id: domainId,
      status: "DISABLED",
    });
  });

  it("writes audit and publishes domain.changed when creating a domain", async () => {
    await createTenantDomain(tx, ctx, {
      hostname: "learn.example.com",
      type: "CUSTOM_DOMAIN",
      makePrimary: false,
    });

    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        actorMembershipId,
        requestId,
      }),
      expect.objectContaining({
        action: "tenant.domain.created",
        after: expect.objectContaining({
          hostname: "learn.example.com",
          status: "PENDING",
        }),
      }),
    );
    expect(outboxPublishMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "domain.changed",
        payload: expect.objectContaining({
          tenantId,
          domainId,
          hostname: "learn.example.com",
          action: "created",
        }),
      }),
    );
  });

  it("writes audit and publishes domain.changed when deleting a domain", async () => {
    await deleteTenantDomain(tx, ctx, domainId);

    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        actorMembershipId,
        requestId,
      }),
      expect.objectContaining({
        action: "tenant.domain.deleted",
        after: { status: "DISABLED" },
      }),
    );
    expect(outboxPublishMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "domain.changed",
        payload: expect.objectContaining({
          tenantId,
          domainId,
          action: "disabled",
        }),
      }),
    );
  });
});
