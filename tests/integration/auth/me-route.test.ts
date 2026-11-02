import { describe, expect, it, vi } from "vitest";
import { meOutputSchema, toSessionSafeIdentity } from "@atlas/auth";
import { requireSessionUser, resolveSessionPrincipal } from "@atlas/api/session-user";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { requireBetterAuthUser } from "../../../backend/packages/auth/src/better-auth-runtime";

// Better Auth's session check is stubbed; the seam resolves the principal from the db.
vi.mock("../../../backend/packages/auth/src/better-auth-runtime", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authProvider: () => "better-auth",
  requireBetterAuthUser: vi.fn(),
}));

describe("GET /api/v1/me assembly", () => {
  it("returns host-resolved tenant and session-safe identity", async () => {
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            tenant_id: "tenant-a-id",
            tenant_slug: "tenant-a",
            tenant_state: "ACTIVE",
            domain_id: "tenant-a-domain-id",
            domain_status: "ACTIVE",
            hostname: "tenant-a.example.com",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "018f0000-0000-7000-8000-000000000010",
            email: "user@example.com",
            email_normalized: "user@example.com",
            global_status: "active",
            mfa_enabled: false,
            last_login_at: null,
          },
        ]),
    };

    vi.mocked(requireBetterAuthUser).mockResolvedValue({
      principalId: "018f0000-0000-7000-8000-000000000010",
      email: "user@example.com",
      emailConfirmed: true,
      mfaEnabled: false,
      sessionAssuranceLevel: "aal1",
    });

    const req = new Request("https://tenant-a.example.com/api/v1/me", {
      headers: {
        host: "tenant-a.example.com",
        cookie: "atlas_session=opaque.signature",
      },
    });

    const tenant = await resolveTenantFromRequest({ req, db });
    const user = await requireSessionUser(req);
    const principal = await resolveSessionPrincipal({ db, user });

    const body = meOutputSchema.parse({
      data: {
        tenant: {
          id: tenant.tenantId,
          slug: tenant.tenantSlug,
          state: tenant.tenantState,
        },
        identity: toSessionSafeIdentity(principal),
      },
    });

    expect(body.data.tenant.slug).toBe("tenant-a");
    expect(body.data.identity).toMatchObject({
      authenticated: true,
      emailNormalized: "user@example.com",
    });
    expect(body.data.identity).not.toHaveProperty("id");
    expect(body.data.identity).not.toHaveProperty("principalId");
  });

  it("requires authentication for /me", async () => {
    const { authRequired } = await import("@atlas/auth");

    vi.mocked(requireBetterAuthUser).mockRejectedValue(authRequired());

    await expect(
      requireSessionUser(
        new Request("https://tenant-a.example.com/api/v1/me", {
          headers: { host: "tenant-a.example.com" },
        }),
      ),
    ).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
    });
  });
});
