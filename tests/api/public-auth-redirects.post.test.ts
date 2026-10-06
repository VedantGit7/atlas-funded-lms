import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Magic-link email and OAuth sign-in: the return URL Supabase receives must be
 * on the host the request came from, checked before Supabase is called.
 */

const { mockSendMagicLink, mockStartOAuthSignIn } = vi.hoisted(() => ({
  mockSendMagicLink: vi.fn(),
  mockStartOAuthSignIn: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendMagicLink: (...args: unknown[]) => mockSendMagicLink(...args),
  startOAuthSignIn: (...args: unknown[]) => mockStartOAuthSignIn(...args),
}));

import { POST as magicLink } from "../../backend/apps/api/src/app/api/v1/public/auth/magic-link/route";
import { POST as oauthStart } from "../../backend/apps/api/src/app/api/v1/public/auth/oauth/start/route";

function createRequest(path: string, body: object) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    method: "POST",
    headers: { host: "tenant-a.example.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("public auth redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMagicLink.mockResolvedValue(undefined);
    mockStartOAuthSignIn.mockResolvedValue({
      url: "https://accounts.example.com/o/oauth2",
      codeVerifier: "verifier",
    });
  });

  it("sends a magic link back to this site", async () => {
    const response = await magicLink(
      createRequest("/api/v1/public/auth/magic-link", {
        email: "user@example.com",
        emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
      }),
    );
    expect(response.status).toBe(200);
    expect(mockSendMagicLink).toHaveBeenCalledWith({
      email: "user@example.com",
      emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
    });
  });

  it.each(["https://tenant-b.example.com/auth/confirm", "https://evil.example/auth/confirm"])(
    "refuses a magic link that would lead to %s, and sends nothing",
    async (emailRedirectTo) => {
      const response = await magicLink(
        createRequest("/api/v1/public/auth/magic-link", {
          email: "user@example.com",
          emailRedirectTo,
        }),
      );
      expect(response.status).toBe(400);
      expect(mockSendMagicLink).not.toHaveBeenCalled();
    },
  );

  it("starts OAuth returning to this site", async () => {
    const response = await oauthStart(
      createRequest("/api/v1/public/auth/oauth/start", {
        provider: "google",
        redirectTo: "https://tenant-a.example.com/auth/callback",
      }),
    );
    expect(response.status).toBe(200);
    expect(mockStartOAuthSignIn).toHaveBeenCalledWith({
      provider: "google",
      redirectTo: "https://tenant-a.example.com/auth/callback",
    });
  });

  it("refuses OAuth that would return to another site", async () => {
    const response = await oauthStart(
      createRequest("/api/v1/public/auth/oauth/start", {
        provider: "google",
        redirectTo: "https://evil.example/auth/callback",
      }),
    );
    expect(response.status).toBe(400);
    expect(mockStartOAuthSignIn).not.toHaveBeenCalled();
  });
});
