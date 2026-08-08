import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSetSession, mockGetUser, mockGetSession } = vi.hoisted(() => ({
  mockSetSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({
    auth: {
      setSession: (...args: unknown[]) => mockSetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  }),
}));

import { establishSessionFromTokens } from "../../../backend/packages/auth/src/public-auth.service";

function createDb(principalRow: Record<string, unknown>) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([principalRow]),
  };
}

const principalRow = {
  id: "principal-1",
  email: "user@example.com",
  email_normalized: "user@example.com",
  global_status: "active",
  mfa_enabled: false,
  last_login_at: null,
};

describe("establishSessionFromTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "supabase-user-1",
          email: "user@example.com",
          user_metadata: { display_name: "Atlas User" },
          factors: [],
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: {
        session: { access_token: "fresh-access", refresh_token: "fresh-refresh", expires_in: 3600 },
      },
      error: null,
    });
  });

  it("validates the tokens, mirrors the principal, and returns the canonical session", async () => {
    const db = createDb(principalRow);

    const result = await establishSessionFromTokens({
      db,
      accessToken: "hash-access",
      refreshToken: "hash-refresh",
    });

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "hash-access",
      refresh_token: "hash-refresh",
    });
    expect(result.status).toBe("signed_in");
    expect(result.identity).toEqual(
      expect.objectContaining({
        authenticated: true,
        email: "user@example.com",
        emailNormalized: "user@example.com",
        mfaEnabled: false,
      }),
    );
    expect(result.displayName).toBe("Atlas User");
    expect(result.session).toEqual({
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      expiresIn: 3600,
    });
  });

  it("returns a null display name when metadata has none", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "supabase-user-1", email: "user@example.com", user_metadata: {}, factors: [] },
      },
      error: null,
    });

    const result = await establishSessionFromTokens({
      db: createDb(principalRow),
      accessToken: "hash-access",
      refreshToken: "hash-refresh",
    });

    expect(result.displayName).toBeNull();
  });

  it("rejects when the tokens cannot be set", async () => {
    mockSetSession.mockResolvedValue({ error: { message: "invalid token" } });

    await expect(
      establishSessionFromTokens({
        db: createDb(principalRow),
        accessToken: "bad",
        refreshToken: "bad",
      }),
    ).rejects.toThrow();
  });

  it("rejects when the verified user cannot be read", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "no user" } });

    await expect(
      establishSessionFromTokens({
        db: createDb(principalRow),
        accessToken: "hash-access",
        refreshToken: "hash-refresh",
      }),
    ).rejects.toThrow();
  });
});
