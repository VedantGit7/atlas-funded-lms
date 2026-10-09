import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertAuthPrincipal = vi.hoisted(() => vi.fn());
vi.mock("../../../backend/packages/auth/src/auth-principal.repository", () => ({
  upsertAuthPrincipal,
}));

import {
  completeOAuthSignIn,
  startOAuthSignIn,
} from "../../../backend/packages/auth/src/oauth.service";

/**
 * OAuth sign-in carries the PKCE verifier between two stateless requests: it
 * reads it out of the Supabase client's storage when the flow starts, and the
 * callback seeds it back for the code exchange. Both depend on how the
 * installed supabase-js uses that storage, so these tests run the real client:
 * starting a flow only builds a URL, and the exchange's one request is
 * answered by a stubbed fetch.
 *
 * This caught OAuth sign-in failing on every attempt: with persistSession
 * false the client ignored the storage entirely. supabase-js 2.111 also moved
 * verifiers to per-flow slots (still writing the old key for now) and can add
 * an `sb_flow_id` to redirect URLs, which exact Supabase allow-list entries
 * would reject; an upgrade that changes either fails here.
 */
describe("OAuth PKCE against the installed supabase-js", () => {
  const redirectTo = "https://tenant.example.test/auth/callback";
  const db = { $queryRaw: vi.fn() };

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-tests");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests");
    upsertAuthPrincipal.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("starts a flow: the verifier behind the URL's challenge, redirect_to as given", async () => {
    const { url, codeVerifier } = await startOAuthSignIn({ provider: "google", redirectTo });

    const authorize = new URL(url);
    expect(authorize.searchParams.get("redirect_to")).toBe(redirectTo);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
    expect(authorize.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(codeVerifier).digest("base64url"),
    );
  });

  it("completes a flow by exchanging the code with the verifier from the start", async () => {
    const { codeVerifier } = await startOAuthSignIn({ provider: "google", redirectTo });
    const exchanges: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        exchanges.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              email: "learner@example.test",
              email_confirmed_at: "2026-10-09T00:00:00Z",
              factors: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    upsertAuthPrincipal.mockResolvedValue({
      id: "principal-1",
      email: "learner@example.test",
      emailNormalized: "learner@example.test",
      globalStatus: "active",
      mfaEnabled: false,
      lastLoginAt: null,
    });

    const signedIn = await completeOAuthSignIn({ db, code: "auth-code", codeVerifier });

    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]?.url).toContain("/auth/v1/token?grant_type=pkce");
    expect(exchanges[0]?.body).toMatchObject({
      auth_code: "auth-code",
      code_verifier: codeVerifier,
    });
    expect(signedIn).toMatchObject({
      status: "signed_in",
      email: "learner@example.test",
      session: { accessToken: "access-token", refreshToken: "refresh-token" },
    });
    expect(upsertAuthPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ emailConfirmed: true, markLogin: true }),
    );
  });
});
