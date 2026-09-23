import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  setSession: vi.fn(),
  listFactors: vi.fn(),
  refresh: vi.fn(),
  applyCookies: vi.fn(),
  cookieValues: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues.get(name);
      return value === undefined ? undefined : { value };
    },
  }),
}));
vi.mock("../../../backend/packages/auth/src/supabase-server", () => {
  const client = () => ({
    auth: {
      getUser: mocks.getUser,
      getClaims: mocks.getClaims,
      setSession: mocks.setSession,
      mfa: { listFactors: mocks.listFactors },
    },
  });
  return { createSupabaseAdminServerClient: client, createSupabasePublicServerClient: client };
});
vi.mock("../../../backend/packages/auth/src/public-auth.service", () => ({
  refreshSessionFromRefreshToken: mocks.refresh,
}));
vi.mock("../../../backend/packages/auth/src/cookie-store", () => ({
  applyAuthSessionToCookieStore: mocks.applyCookies,
  readSessionPersistence: async () => false,
}));

import { requireSupabaseUser } from "@atlas/auth/session";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
} from "../../../backend/packages/auth/src/cookie-names";

const enrolledUser = {
  id: "user-1",
  email: "operator@example.com",
  factors: [{ id: "factor-1", factor_type: "totp", status: "verified" }],
  user_metadata: { aal: "aal2", mfaEnabled: true },
};

function request(transport: "bearer" | "cookie" = "bearer") {
  return new Request("https://tenant.example.com/api/v1/me", {
    headers:
      transport === "bearer"
        ? { authorization: "Bearer presented-token" }
        : { cookie: `${ATLAS_ACCESS_TOKEN_COOKIE}=presented-token` },
  });
}

describe("verified session assurance (F01)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.cookieValues.clear();
    mocks.getUser.mockResolvedValue({ data: { user: enrolledUser }, error: null });
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: enrolledUser.id, aal: "aal1" } },
      error: null,
    });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.listFactors.mockResolvedValue({
      data: { totp: enrolledUser.factors, phone: [] },
      error: null,
    });
  });

  it.each(["bearer", "cookie"] as const)(
    "distinguishes enrollment from AAL1 for %s auth",
    async (transport) => {
      const user = await requireSupabaseUser(request(transport));
      expect(user).toMatchObject({ mfaEnabled: true, sessionAssuranceLevel: "aal1" });
      expect(mocks.getUser).toHaveBeenCalledWith("presented-token");
      expect(mocks.getClaims).toHaveBeenCalledWith("presented-token");
    },
  );

  it("accepts AAL2 claims on the presented token without a refresh cookie", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", aal: "aal2" } },
      error: null,
    });
    await expect(requireSupabaseUser(request())).resolves.toMatchObject({
      sessionAssuranceLevel: "aal2",
    });
  });

  it("does not replace a bearer token with a different cookie session", async () => {
    mocks.cookieValues.set(ATLAS_ACCESS_TOKEN_COOKIE, "different-cookie-token");
    mocks.cookieValues.set(ATLAS_REFRESH_TOKEN_COOKIE, "different-refresh-token");
    await expect(requireSupabaseUser(request())).resolves.toMatchObject({
      sessionAssuranceLevel: "aal1",
    });
    expect(mocks.getClaims).toHaveBeenCalledWith("presented-token");
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "aal3", "AAL2", 2])(
    "does not promote missing or unknown assurance (%s)",
    async (aal) => {
      mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal } }, error: null });
      await expect(requireSupabaseUser(request())).resolves.toMatchObject({
        sessionAssuranceLevel: null,
      });
    },
  );

  it.each([
    { data: null, error: { message: "invalid signature" } },
    { data: { claims: { sub: "other-user", aal: "aal2" } }, error: null },
    { data: { claims: { aal: "aal2" } }, error: null },
  ])("rejects unverifiable or mismatched claims", async (claimsResult) => {
    mocks.getClaims.mockResolvedValue(claimsResult);
    await expect(requireSupabaseUser(request())).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
    });
  });

  it("rejects a thrown verification error", async () => {
    mocks.getClaims.mockRejectedValue(new Error("verification unavailable"));
    await expect(requireSupabaseUser(request())).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("does not use claims when the auth service rejects the user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    await expect(requireSupabaseUser(request())).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("keeps pending factor enrollment separate from assurance", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { ...enrolledUser, factors: [{ status: "unverified" }] } },
      error: null,
    });
    await expect(requireSupabaseUser(request())).resolves.toMatchObject({
      mfaEnabled: false,
      sessionAssuranceLevel: "aal1",
    });
  });

  it("verifies the refreshed token when no access token is present", async () => {
    mocks.cookieValues.set(ATLAS_REFRESH_TOKEN_COOKIE, "refresh-token");
    mocks.refresh.mockResolvedValue({
      accessToken: "refreshed-token",
      refreshToken: "rotated-refresh",
      expiresIn: 3600,
    });
    mocks.applyCookies.mockImplementation(async () => {
      mocks.cookieValues.set(ATLAS_ACCESS_TOKEN_COOKIE, "refreshed-token");
      mocks.cookieValues.set(ATLAS_REFRESH_TOKEN_COOKIE, "rotated-refresh");
    });
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", aal: "aal2" } },
      error: null,
    });
    await expect(
      requireSupabaseUser(new Request("https://tenant.example.com/api/v1/me")),
    ).resolves.toMatchObject({ sessionAssuranceLevel: "aal2" });
    expect(mocks.getUser).toHaveBeenCalledWith("refreshed-token");
    expect(mocks.getClaims).toHaveBeenCalledWith("refreshed-token");
  });
});
