import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword, signupWithPassword } from "@atlas/auth";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();

vi.mock("../../../packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
    },
  }),
}));

function mockDb(rows: unknown[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
  };
}

describe("public auth routes service layer", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
    mockSignUp.mockReset();
  });

  it("login bridges Supabase identity into auth_principals", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "018f0000-0000-7000-8000-000000000001",
          email: "user@example.com",
          factors: [],
        },
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const db = mockDb([
      {
        id: "018f0000-0000-7000-8000-000000000010",
        email: "user@example.com",
        email_normalized: "user@example.com",
        global_status: "active",
        mfa_enabled: false,
        last_login_at: new Date(),
      },
    ]);

    const result = await loginWithPassword({
      db,
      input: {
        email: "user@example.com",
        password: "password123",
      },
    });

    expect(result.status).toBe("signed_in");
    expect(result.identity).toMatchObject({
      authenticated: true,
      email: "user@example.com",
      emailNormalized: "user@example.com",
    });
    expect(result.identity).not.toHaveProperty("id");
    expect(result.session?.accessToken).toBe("access-token");
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("login returns safe invalid-credentials error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    await expect(
      loginWithPassword({
        db: mockDb([]),
        input: {
          email: "user@example.com",
          password: "wrong-password",
        },
      }),
    ).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("signup returns verification_required when Supabase does not create a session", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: "018f0000-0000-7000-8000-000000000001",
          email: "user@example.com",
          factors: [],
        },
        session: null,
      },
      error: null,
    });

    const db = mockDb([
      {
        id: "018f0000-0000-7000-8000-000000000010",
        email: "user@example.com",
        email_normalized: "user@example.com",
        global_status: "active",
        mfa_enabled: false,
        last_login_at: null,
      },
    ]);

    const result = await signupWithPassword({
      db,
      input: {
        email: "user@example.com",
        password: "password123",
      },
    });

    expect(result.status).toBe("verification_required");
    expect(result.session).toBeUndefined();
    expect(result.identity).toMatchObject({
      authenticated: true,
      emailNormalized: "user@example.com",
    });
  });
});
