import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), headers: vi.fn(), cookies: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: mocks.cookies }));
vi.mock(
  "@/lib/auth/safe-redirect",
  async () => import("../../../frontend/apps/web/src/lib/auth/safe-redirect"),
);
vi.mock(
  "@/lib/server/resolve-request-origin",
  async () => import("../../../frontend/apps/web/src/lib/server/resolve-request-origin"),
);
vi.mock(
  "@/lib/http-headers",
  async () => import("../../../frontend/apps/web/src/lib/http-headers"),
);
vi.mock("@atlas/auth/session", () => ({ extractAccessToken: vi.fn(async () => null) }));
vi.mock("@atlas/auth/supabase-server", () => ({ createSupabaseAdminServerClient: vi.fn() }));

const key = "synthetic-internal-forwarding-key-0123456789";

function expectForwarding() {
  expect(mocks.fetch).toHaveBeenCalledOnce();
  const [url, init] = mocks.fetch.mock.calls[0] as [string | URL, RequestInit];
  expect(String(url)).toMatch(/^https:\/\/api\.example\.com\/api\/v1\//);
  expect(init.redirect).toBe("error");
  const headers = new Headers(init.headers);
  expect(headers.get("x-atlas-proxy-key")).toBe(key);
  expect(headers.get("x-atlas-tenant-host")).toBe("tenant.example.com");
  expect(headers.get("x-forwarded-host")).toBe("tenant.example.com");
  expect(headers.get("x-atlas-client-ip")).toBe("198.51.100.42");
  return headers;
}

describe("F11 internal API callers carry authenticated browser context", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("API_INTERNAL_URL", "https://api.example.com");
    vi.stubEnv("API_PROXY_SECRET", key);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "");
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.headers.mockResolvedValue(
      new Headers({ host: "tenant.example.com", "x-atlas-client-ip": "198.51.100.42" }),
    );
    mocks.cookies.mockResolvedValue({ getAll: () => [], get: () => undefined, set: vi.fn() });
    mocks.fetch.mockResolvedValue(Response.json({ data: { ok: true } }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("authenticates server API reads", async () => {
    const { serverApi } = await import("../../../frontend/apps/web/src/lib/api/server");
    await serverApi.get("/api/v1/me");
    expectForwarding();
  });

  it("authenticates public auth mutations", async () => {
    const { serverPublicApi } =
      await import("../../../frontend/apps/web/src/lib/server/public-auth-fetch");
    await serverPublicApi.login({ email: "learner@example.com", password: "synthetic" });
    expectForwarding();
  });

  it("authenticates email confirmation", async () => {
    const { confirmEmailViaInternalApi } =
      await import("../../../frontend/apps/web/src/lib/server/public-auth-fetch");
    await confirmEmailViaInternalApi({ tokenHash: "synthetic", type: "signup" });
    expectForwarding();
  });

  it.each(["server", "proxy"])("authenticates %s session refresh", async (caller) => {
    const { refreshSessionCookieHeader, tryRefreshSessionForProxy } =
      await import("../../../frontend/apps/web/src/lib/server/session-refresh");
    if (caller === "server") {
      await refreshSessionCookieHeader("atlas_refresh_token=refresh", "tenant.example.com");
    } else {
      await tryRefreshSessionForProxy(
        new NextRequest("https://tenant.example.com/profile", {
          headers: {
            host: "tenant.example.com",
            cookie: "atlas_refresh_token=refresh",
            "x-forwarded-for": "198.51.100.42",
            "x-atlas-client-ip": "192.0.2.99",
          },
        }),
      );
    }
    expectForwarding();
  });

  it("authenticates invitation preview", async () => {
    const { loadInviteAcceptContext } =
      await import("../../../frontend/apps/web/src/lib/server/load-invite-accept-context");
    await loadInviteAcceptContext("synthetic-invite");
    expectForwarding();
  });

  it.each(["tenant.example.com", "127.0.0.1:3000"])(
    "forwards stamped OAuth callback context with Host %s and relays session cookies",
    async (transportHost) => {
      mocks.fetch.mockResolvedValue(
        Response.json(
          { data: { status: "AUTHENTICATED", redirectTo: "/profile" } },
          { headers: { "set-cookie": "atlas_access_token=new-session; Path=/; HttpOnly; Secure" } },
        ),
      );
      const { GET } = await import("../../../frontend/apps/web/src/app/auth/callback/route");
      const response = await GET(
        new NextRequest("https://tenant.example.com/auth/callback?code=synthetic", {
          headers: {
            host: transportHost,
            // The web proxy replaces this header from the original browser Host.
            "x-atlas-tenant-host": "tenant.example.com",
            "x-atlas-client-ip": "198.51.100.42",
            "x-forwarded-proto": "https",
            cookie: "atlas_oauth_verifier=verifier; atlas_oauth_remember=1",
            "x-atlas-proxy-key": "forged-key",
          },
        }),
      );

      expectForwarding();
      expect(response.headers.get("location")).toBe("https://tenant.example.com/profile");
      expect(response.headers.getSetCookie()).toContain(
        "atlas_access_token=new-session; Path=/; HttpOnly; Secure",
      );
      expect(response.headers.get("x-atlas-proxy-key")).toBeNull();
    },
  );

  it("authenticates OAuth start and keeps the browser callback origin", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({
        data: { url: "https://auth.example.com/authorize", codeVerifier: "verifier" },
      }),
    );
    const { GET } = await import("../../../frontend/apps/web/src/app/auth/oauth/[provider]/route");
    const response = await GET(
      new NextRequest("https://tenant.example.com/auth/oauth/google", {
        headers: { host: "tenant.example.com", "x-atlas-client-ip": "198.51.100.42" },
      }),
      { params: Promise.resolve({ provider: "google" }) },
    );

    expectForwarding();
    expect(JSON.parse(mocks.fetch.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      redirectTo: "https://tenant.example.com/auth/callback",
    });
    expect(response.headers.get("location")).toBe("https://auth.example.com/authorize");
  });
});
