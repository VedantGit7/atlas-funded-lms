import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Email change and identity linking, run through createTenantRoute: the return
 * URL must be on the host the request came from, checked before Supabase is
 * asked to send anything.
 */

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  principal: vi.fn(),
  membership: vi.fn(),
  can: vi.fn(),
  changeEmail: vi.fn(),
  startLinkIdentity: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/session", () => ({ requireSupabaseUser: mocks.user }));
vi.mock("../../../backend/packages/auth/src/auth-principal.repository", () => ({
  upsertAuthPrincipal: mocks.principal,
}));
vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  changeEmail: mocks.changeEmail,
  startLinkIdentity: mocks.startLinkIdentity,
}));
vi.mock("../../../backend/apps/api/src/lib/account-security-orchestrator", () => ({
  emitSecurityNotification: mocks.notify,
}));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  // Stands in for a service that wrote its audit entry (M7).
  withTenantTx: (_ctx: unknown, fn: (tx: object) => unknown) =>
    fn({ $queryRaw: async () => [{ written: "on" }] }),
}));
vi.mock("@atlas/membership", () => ({ requireActiveMembership: mocks.membership }));
vi.mock("@atlas/tenancy", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveTenantFromRequest: async () => ({ tenantId: "tenant-1", host: "tenant-a.example.com" }),
}));
vi.mock("@atlas/authorization", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  can: mocks.can,
  enforceEntitlement: vi.fn(),
}));
vi.mock("../../../backend/packages/api/src/idempotency-registry", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withIdempotency: (_tx: unknown, _claim: unknown, run: () => Promise<unknown>) => run(),
}));
vi.mock("../../../backend/packages/api/src/tenant-usage-meter", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  recordTenantUsage: vi.fn(),
}));

import { POST as changeEmailRoute } from "../../../backend/apps/api/src/app/api/v1/me/security/email/route";
import { POST as linkIdentityRoute } from "../../../backend/apps/api/src/app/api/v1/me/security/identities/link/route";

function request(path: string, body: object) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    method: "POST",
    headers: {
      origin: "https://tenant-a.example.com",
      "content-type": "application/json",
      "idempotency-key": `key-${path.length}-${String(Math.random()).slice(2, 10)}`,
    },
    body: JSON.stringify(body),
  });
}

describe("auth redirects on tenant routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({
      supabaseUserId: "user-1",
      email: "learner@example.com",
      mfaEnabled: false,
      sessionAssuranceLevel: "aal1",
    });
    mocks.principal.mockResolvedValue({ id: "principal-1", mfaEnabled: false });
    mocks.membership.mockResolvedValue({ membershipId: "member-1" });
    mocks.can.mockResolvedValue({ allowed: true });
    mocks.changeEmail.mockResolvedValue({ email: "new@example.com" });
    mocks.startLinkIdentity.mockResolvedValue({ url: "https://accounts.example.com/o/oauth" });
  });

  it("changes email with a confirmation link back to this tenant", async () => {
    const response = await changeEmailRoute(
      request("/api/v1/me/security/email", {
        newEmail: "new@example.com",
        emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.changeEmail).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
    });
  });

  it.each(["https://tenant-b.example.com/auth/confirm", "https://evil.example/auth/confirm"])(
    "refuses an email change whose link would lead to %s, and sends nothing",
    async (emailRedirectTo) => {
      const response = await changeEmailRoute(
        request("/api/v1/me/security/email", { newEmail: "new@example.com", emailRedirectTo }),
      );
      expect(response.status).toBe(400);
      expect(mocks.changeEmail).not.toHaveBeenCalled();
    },
  );

  it("links an identity returning to this tenant", async () => {
    const response = await linkIdentityRoute(
      request("/api/v1/me/security/identities/link", {
        provider: "google",
        redirectTo: "https://tenant-a.example.com/profile/security",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.startLinkIdentity).toHaveBeenCalledWith({
      provider: "google",
      redirectTo: "https://tenant-a.example.com/profile/security",
    });
  });

  it("refuses to link an identity that would return to another site", async () => {
    const response = await linkIdentityRoute(
      request("/api/v1/me/security/identities/link", {
        provider: "google",
        redirectTo: "https://evil.example/profile/security",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.startLinkIdentity).not.toHaveBeenCalled();
  });
});
