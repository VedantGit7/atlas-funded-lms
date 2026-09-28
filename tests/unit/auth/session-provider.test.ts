import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../../../backend/packages/auth/src/env", () => ({
  getAuthEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    NODE_ENV: "test",
  }),
}));
vi.mock("../../../backend/packages/auth/src/public-auth.service", () => ({
  refreshSessionFromRefreshToken: vi.fn(),
}));
vi.mock("../../../backend/packages/auth/src/cookie-store", () => ({
  applyAuthSessionToCookieStore: vi.fn(),
  readSessionPersistence: async () => false,
}));

import { requireSupabaseUser } from "@atlas/auth/session";

const user = { id: "user-1", email: "learner@example.test", factors: [] };
function token(claims: Record<string, unknown> = {}) {
  const input = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      iss: "https://auth.example.test/auth/v1",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      aal: "aal1",
      ...claims,
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  return `${input}.${createHmac("sha256", "test-signing-key").update(input).digest("base64url")}`;
}
function request(accessToken = token()) {
  return new Request("https://tenant.example.test/api/v1/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

describe("session verification with the installed Supabase SDK", () => {
  const transport = vi.fn<typeof fetch>();
  beforeEach(() => {
    transport.mockReset().mockImplementation(async () => Response.json(user));
    vi.stubGlobal("fetch", transport);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("makes one live user request while verifying symmetric token claims", async () => {
    await expect(requireSupabaseUser(request())).resolves.toMatchObject({
      supabaseUserId: user.id,
      sessionAssuranceLevel: "aal1",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("checks the provider again on the next request and rejects revocation", async () => {
    await requireSupabaseUser(request());
    transport
      .mockClear()
      .mockImplementation(async () =>
        Response.json({ msg: "revoked", code: "bad_jwt" }, { status: 401 }),
      );
    await expect(requireSupabaseUser(request())).rejects.toMatchObject({ status: 401 });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("still rejects expired tokens even if the provider fixture accepts them", async () => {
    await expect(requireSupabaseUser(request(token({ exp: 1 })))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("binds verified claims to the user returned by the provider", async () => {
    await expect(
      requireSupabaseUser(request(token({ sub: "different-user", aal: "aal2" }))),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([false, true])(
    "preserves asymmetric signature verification (tampered=%s)",
    async (tampered) => {
      const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const kid = `fixture-key-${tampered}`;
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString(
        "base64url",
      );
      const payload = token().split(".")[1];
      const input = `${header}.${payload}`;
      const signature = sign("sha256", Buffer.from(input), privateKey).toString("base64url");
      const verifiedToken = `${input}.${tampered ? "AAAA" : signature}`;
      transport.mockImplementation(async (url) =>
        String(url).includes("jwks.json")
          ? Response.json({
              keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" }],
            })
          : Response.json(user),
      );
      if (tampered) {
        await expect(requireSupabaseUser(request(verifiedToken))).rejects.toMatchObject({
          status: 401,
        });
      } else {
        await expect(requireSupabaseUser(request(verifiedToken))).resolves.toMatchObject({
          supabaseUserId: user.id,
        });
      }
      expect(transport.mock.calls.filter(([url]) => String(url).endsWith("/user"))).toHaveLength(1);
    },
  );

  it.each([429, 500, 502, 503])("classifies provider HTTP %s as unavailable", async (status) => {
    transport.mockImplementation(async () => Response.json({ msg: "provider failed" }, { status }));
    await expect(requireSupabaseUser(request())).rejects.toMatchObject({
      status: 503,
      expose: false,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
