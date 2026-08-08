import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefreshSession } = vi.hoisted(() => ({
  mockRefreshSession: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  }),
}));

import { refreshSessionFromRefreshToken } from "../../../backend/packages/auth/src/public-auth.service";

describe("refreshSessionFromRefreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a rotated session when Supabase refresh succeeds", async () => {
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const result = await refreshSessionFromRefreshToken({
      refreshToken: "old-refresh",
    });

    expect(mockRefreshSession).toHaveBeenCalledWith({
      refresh_token: "old-refresh",
    });
    expect(result).toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 3600,
    });
  });

  it("rejects when Supabase refresh fails", async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });

    await expect(
      refreshSessionFromRefreshToken({
        refreshToken: "bad-refresh",
      }),
    ).rejects.toThrow();
  });
});
