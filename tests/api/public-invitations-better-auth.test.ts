import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan task 3.6: the invitation preview and set-password routes with
 * AUTH_PROVIDER=better-auth. The account flows run against Postgres in
 * tests/integration/auth/better-auth-invitations.test.ts.
 */

const TENANT_ID = "018f0000-0000-7000-8000-000000000001";
const TOKEN = "invite-token-0123456789abcdef";

const mocks = vi.hoisted(() => ({
  provider: "better-auth" as "supabase" | "better-auth",
  previewInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  invitedAccountState: vi.fn(),
  createAccount: vi.fn(),
  findPrincipal: vi.fn(),
  sessionUser: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authProvider: () => mocks.provider,
  invitedAccountState: (...args: unknown[]) => mocks.invitedAccountState(...args),
  createAccountFromInvitation: (...args: unknown[]) => mocks.createAccount(...args),
  findActiveSessionPrincipal: (...args: unknown[]) => mocks.findPrincipal(...args),
  assertPasswordNotBreached: () => Promise.resolve(),
}));
vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveRequestTenant: () => Promise.resolve({ tenantId: TENANT_ID, requestId: "r" }),
  requireSessionUser: (...args: unknown[]) => mocks.sessionUser(...args),
}));
vi.mock("@atlas/tenancy", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveTenantFromRequest: () => Promise.resolve({ tenantId: TENANT_ID }),
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => fn({}),
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@atlas/membership", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  previewInvitation: (...args: unknown[]) => mocks.previewInvitation(...args),
  acceptInvitation: (...args: unknown[]) => mocks.acceptInvitation(...args),
}));
vi.mock("@atlas/domain-identity", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readMembershipRoleKeys: () => Promise.resolve(["learner"]),
}));

import { GET as preview } from "../../backend/apps/api/src/app/api/v1/public/invitations/preview/route";
import { POST as setPassword } from "../../backend/apps/api/src/app/api/v1/public/invitations/set-password/route";

function request(path: string, body?: object) {
  return new NextRequest(`http://academy.localhost.test${path}`, {
    method: body ? "POST" : "GET",
    headers: { host: "academy.localhost.test", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("invitations with Better Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.provider = "better-auth";
    mocks.previewInvitation.mockResolvedValue({ invitedEmail: "invitee@example.test" });
    mocks.sessionUser.mockRejectedValue(new Error("no session"));
    mocks.invitedAccountState.mockResolvedValue("none");
    mocks.createAccount.mockResolvedValue({
      principalId: "principal-1",
      cookies: { setCookies: ["atlas_session=t.s; Path=/; HttpOnly"] },
    });
    mocks.findPrincipal.mockResolvedValue({
      id: "principal-1",
      emailNormalized: "invitee@example.test",
      mfaEnabled: false,
    });
    mocks.acceptInvitation.mockResolvedValue({ membership: { id: "membership-1" } });
  });

  it("previews whether the invited address has an account, and who is signed in", async () => {
    mocks.sessionUser.mockResolvedValue({ email: "Someone@Example.test" });
    const response = await preview(request(`/api/v1/public/invitations/preview?token=${TOKEN}`));

    expect(await response.json()).toEqual({
      data: {
        invitedEmail: "invitee@example.test",
        signedInEmail: "someone@example.test",
        account: "none",
      },
    });
    expect(mocks.invitedAccountState).toHaveBeenCalledWith("invitee@example.test");
  });

  it("creates the invited account, not one for an address the client names", async () => {
    const response = await setPassword(
      request("/api/v1/public/invitations/set-password", {
        token: TOKEN,
        password: "a-new-strong-password",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: "invitee@example.test", password: "a-new-strong-password" }),
    );
    expect(mocks.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: expect.objectContaining({ id: "principal-1" }) as unknown,
      }),
    );
    expect(response.headers.getSetCookie()).toEqual(["atlas_session=t.s; Path=/; HttpOnly"]);
  });

  it("refuses an invitation that isn't valid, before creating anything", async () => {
    mocks.previewInvitation.mockResolvedValue(null);
    const response = await setPassword(
      request("/api/v1/public/invitations/set-password", {
        token: TOKEN,
        password: "a-new-strong-password",
      }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("still needs the link's session with Supabase", async () => {
    mocks.provider = "supabase";
    const response = await setPassword(
      request("/api/v1/public/invitations/set-password", {
        token: TOKEN,
        password: "a-new-strong-password",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });
});
