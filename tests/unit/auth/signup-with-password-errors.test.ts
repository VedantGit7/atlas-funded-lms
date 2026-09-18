import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignUp } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  }),
}));

import { signupWithPassword } from "../../../backend/packages/auth/src/public-auth.service";
import type { AtlasHttpError } from "../../../backend/packages/core/src/http/errors";

describe("signupWithPassword error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Supabase email rate limits to a user-friendly 429 error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: "email rate limit exceeded",
        status: 429,
        code: "over_email_send_rate_limit",
      },
    });

    await expect(
      signupWithPassword({
        db: { $queryRaw: vi.fn() },
        input: { email: "user@example.com", password: "password123" },
      }),
    ).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining("Too many verification emails"),
    } satisfies Partial<AtlasHttpError>);
  });

  it("maps unknown Supabase signup failures to invalid credentials", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered", status: 400 },
    });

    await expect(
      signupWithPassword({
        db: { $queryRaw: vi.fn() },
        input: { email: "user@example.com", password: "password123" },
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    } satisfies Partial<AtlasHttpError>);
  });
});
