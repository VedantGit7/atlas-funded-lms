import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { createPlatformIdempotencyStore } from "../helpers/platform-idempotency-tx";

const replayStore = createPlatformIdempotencyStore();

const mocks = vi.hoisted(() => ({
  requirePlatformPrincipal: vi.fn(),
  issueTenantOwnerInvitation: vi.fn(),
  sendTenantInvitationEmail: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mocks.requirePlatformPrincipal(...args),
}));
vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendTenantInvitationEmail: mocks.sendTenantInvitationEmail,
}));
vi.mock("@atlas/domain-tenancy", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  issueTenantOwnerInvitation: mocks.issueTenantOwnerInvitation,
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() }),
}));
vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // The pipeline claims the idempotency key through this transaction (M10).
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn(
      replayStore.wrap({
        $queryRaw: vi.fn().mockResolvedValue([]),
        $queryRawUnsafe: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn().mockResolvedValue(0),
        $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      }),
    ),
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/owner-invitation/route";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const inviteUrl = "https://academy.acme-learning.example/invite/accept?token=secret-token";

function request(headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://platform.example.com/api/v1/platform/tenants/${tenantId}/owner-invitation`,
    {
      method: "POST",
      headers: {
        host: "platform.example.com",
        origin: "https://platform.example.com",
        authorization: "Bearer platform-token",
        "content-type": "application/json",
        "idempotency-key": "idem_owner_invitation_test",
        [ATLAS_PLATFORM_REASON_HEADER]: "Launch plan 2.6 staging tenant owner",
        ...headers,
      },
      body: JSON.stringify({ reason: "Launch plan 2.6 staging tenant owner" }),
    },
  );
}

const context = { params: Promise.resolve({ id: tenantId }) };

describe("POST /api/v1/platform/tenants/:id/owner-invitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
      platformPermissions: ["platform.tenant.manage"],
    });
    mocks.issueTenantOwnerInvitation.mockResolvedValue({
      email: "owner@example.test",
      inviteUrl,
      hostname: "academy.acme-learning.example",
      expiresAt: new Date("2026-11-06T00:00:00Z"),
    });
  });

  it("emails the link and answers without it", async () => {
    const response = await POST(request(), context);
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(mocks.requirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: "platform.tenant.manage" }),
    );
    expect(mocks.sendTenantInvitationEmail).toHaveBeenCalledWith({
      email: "owner@example.test",
      inviteUrl,
    });
    expect(body.data).toEqual({
      email: "owner@example.test",
      hostname: "academy.acme-learning.example",
      expiresAt: "2026-11-06T00:00:00.000Z",
    });
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });

  it("requires a recorded reason", async () => {
    const response = await POST(request({ [ATLAS_PLATFORM_REASON_HEADER]: "" }), context);
    expect(response.status).toBe(400);
    expect(mocks.issueTenantOwnerInvitation).not.toHaveBeenCalled();
    expect(mocks.sendTenantInvitationEmail).not.toHaveBeenCalled();
  });
});
