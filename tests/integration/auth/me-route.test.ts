import { describe, expect, it, vi } from "vitest";
import {
  meOutputSchema,
  requireSupabaseUser,
  toSessionSafeIdentity,
  upsertAuthPrincipal,
} from "@atlas/auth";
import { resolveTenantFromRequest } from "@atlas/tenancy";

vi.mock("../../../backend/packages/auth/src/session", () => ({
  extractAccessToken: vi.fn(),
  requireSupabaseUser: vi.fn(),
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

    vi.mocked(requireSupabaseUser).mockResolvedValue({
      supabaseUserId: "018f0000-0000-7000-8000-000000000001",
      email: "user@example.com",
      mfaEnabled: false,
    });

    const req = new Request("https://tenant-a.example.com/api/v1/me", {
      headers: {
        host: "tenant-a.example.com",
        authorization: "Bearer access-token",
      },
    });

    const tenant = await resolveTenantFromRequest({ req, db });
    const supabaseUser = await requireSupabaseUser(req);
    const principal = await upsertAuthPrincipal({
      db,
      supabaseUserId: supabaseUser.supabaseUserId,
      email: supabaseUser.email,
      mfaEnabled: supabaseUser.mfaEnabled,
      markLogin: false,
    });

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
    expect(body.data.identity).not.toHaveProperty("supabaseUserId");
  });

  it("requires authentication for /me", async () => {
    const { authRequired } = await import("@atlas/auth");

    vi.mocked(requireSupabaseUser).mockRejectedValue(authRequired());

    await expect(
      requireSupabaseUser(
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
