import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformTx } from "@atlas/db";

/**
 * A console-provisioned tenant's owner must be able to get in: provisioning
 * gives the invitation the owner role, and "Send owner invitation" delivers a
 * fresh link to the tenant's live domain (launch plan 2.6).
 */

const mocks = vi.hoisted(() => ({
  readPlatformTenantDetail: vi.fn(),
  auditWrite: vi.fn(),
  assignSystemRoleToMembership: vi.fn(),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-read.service", () => ({
  readPlatformTenantDetail: mocks.readPlatformTenantDetail,
}));
vi.mock("@atlas/audit", () => ({ auditWriter: { write: mocks.auditWrite } }));
vi.mock("@atlas/access", () => ({
  assignSystemRoleToMembership: mocks.assignSystemRoleToMembership,
  seedTenantRolePermissions: vi.fn(),
  seedTenantSystemRoles: vi.fn(),
}));

import { issueTenantOwnerInvitation } from "@atlas/domain-tenancy/services/platform-tenant-owner-invitation.service";
import { seedOwnerInvitationFromExistingHelper } from "@atlas/domain-tenancy/services/platform-tenant-provisioning.helpers";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const ownerId = "018f0000-0000-7000-8000-000000000002";
const ctx = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000003",
  requestId: "req_owner_invitation_test",
  reason: "Launch plan 2.6 staging tenant owner",
};
const live = { allowLocalHostnames: false };

/** A transaction that answers the owner lookup and records the token update. */
function fakeTx(owner: { id: string; invited_email_normalized: string } | null) {
  const updates: unknown[][] = [];
  const tx = {
    $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("UPDATE memberships")) {
        updates.push(values);
        return Promise.resolve([{ invite_expires_at: new Date("2026-11-06T00:00:00Z") }]);
      }
      return Promise.resolve(owner ? [owner] : []);
    }),
  };
  return { tx: tx as unknown as PlatformTx, updates };
}

function tenant(state: string, primaryDomain: { hostname: string; status: string } | null) {
  mocks.readPlatformTenantDetail.mockResolvedValue({
    data: {
      id: tenantId,
      state,
      primaryDomain: primaryDomain && { ...primaryDomain, type: "CUSTOM_DOMAIN" },
    },
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return `${String((error as { status?: number }).status)} ${(error as Error).message}`;
  }
}

describe("issueTenantOwnerInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a fresh token for the pending owner and links to the live domain", async () => {
    tenant("ACTIVE", { hostname: "academy.acme-learning.example", status: "ACTIVE" });
    const { tx, updates } = fakeTx({ id: ownerId, invited_email_normalized: "owner@example.test" });

    const result = await issueTenantOwnerInvitation(tx, ctx, tenantId, live);

    expect(result.email).toBe("owner@example.test");
    expect(result.hostname).toBe("academy.acme-learning.example");
    const url = new URL(result.inviteUrl);
    expect(url.origin).toBe("https://academy.acme-learning.example");
    expect(url.pathname).toBe("/invite/accept");
    // Only the token's hash is stored, so the link in the email is the one copy.
    const token = url.searchParams.get("token") ?? "";
    expect(token.length).toBeGreaterThan(30);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.[0]).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
    expect(mocks.auditWrite).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ tenantId, platformPrincipalId: ctx.platformPrincipalId }),
      expect.objectContaining({
        action: "tenant.owner_invitation.sent",
        target: { type: "membership", id: ownerId },
        reason: ctx.reason,
      }),
    );
  });

  it.each([
    ["the tenant is not active", "SUSPENDED", { hostname: "a.example.com", status: "ACTIVE" }],
    ["there is no primary domain", "ACTIVE", null],
    [
      "the primary domain is not verified",
      "ACTIVE",
      { hostname: "a.example.com", status: "PENDING" },
    ],
    [
      "the only domain is a local one",
      "ACTIVE",
      { hostname: "acme.localhost.test", status: "ACTIVE" },
    ],
  ])("refuses when %s, changing nothing", async (_case, state, domain) => {
    tenant(state, domain);
    const { tx, updates } = fakeTx({ id: ownerId, invited_email_normalized: "owner@example.test" });

    expect(await codeOf(issueTenantOwnerInvitation(tx, ctx, tenantId, live))).toMatch(/^409 /);
    expect(updates).toHaveLength(0);
    expect(mocks.auditWrite).not.toHaveBeenCalled();
  });

  it("accepts a local domain where local hostnames are allowed (development)", async () => {
    tenant("ACTIVE", { hostname: "acme.localhost.test", status: "ACTIVE" });
    const { tx } = fakeTx({ id: ownerId, invited_email_normalized: "owner@example.test" });
    const result = await issueTenantOwnerInvitation(tx, ctx, tenantId, {
      allowLocalHostnames: true,
    });
    expect(result.hostname).toBe("acme.localhost.test");
  });

  it("refuses when the owner has already joined", async () => {
    tenant("ACTIVE", { hostname: "a.example.com", status: "ACTIVE" });
    const { tx, updates } = fakeTx(null);
    expect(await codeOf(issueTenantOwnerInvitation(tx, ctx, tenantId, live))).toMatch(
      /^409 .*no pending owner invitation/,
    );
    expect(updates).toHaveLength(0);
  });
});

describe("provisioning's owner invitation", () => {
  it("carries the owner role, as a member invitation carries the learner role", async () => {
    const tx = {
      $queryRaw: vi.fn(() => Promise.resolve([{ id: ownerId }])),
    } as unknown as PlatformTx;

    await seedOwnerInvitationFromExistingHelper(tx, {
      tenantId,
      email: "Owner@Example.test",
      displayName: "Owner",
      requestId: ctx.requestId,
    });

    expect(mocks.assignSystemRoleToMembership).toHaveBeenCalledWith({
      tx,
      tenantId,
      membershipId: ownerId,
      roleKey: "owner",
      assignedByMembershipId: null,
    });
  });
});
