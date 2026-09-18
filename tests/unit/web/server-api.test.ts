import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHeaders = vi.fn();
const mockCookies = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}));

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  const payload = JSON.stringify(body);
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => payload,
  };
}

describe("serverApi", () => {
  beforeEach(() => {
    vi.resetModules();
    mockHeaders.mockResolvedValue(
      new Headers({
        host: "tenant-a.localhost.test",
        "x-forwarded-proto": "https",
      }),
    );
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: "atlas_access_token", value: "token-123" }],
      get: (name: string) => {
        if (name === "atlas_access_token") return { name, value: "token-123" };
        return undefined;
      },
    });
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
  });

  it("forwards cookies and returns JSON for successful GET requests", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { displayName: "Atlas Tenant" } }));

    const { serverApi } = await import("../../../frontend/apps/web/src/lib/server-api");

    const result = await serverApi.get<{ data: { displayName: string } }>("/api/v1/branding");

    expect(result.data.displayName).toBe("Atlas Tenant");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3001/api/v1/branding");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("cookie")).toBe("atlas_access_token=token-123");
    expect((init.headers as Headers).get("x-forwarded-host")).toBe("tenant-a.localhost.test");
    expect((init.headers as Headers).get("x-atlas-tenant-host")).toBe("tenant-a.localhost.test");
  });

  it("falls back to middleware-stamped cookies when cookies() is empty", async () => {
    mockCookies.mockResolvedValue({ getAll: () => [], get: () => undefined });
    mockHeaders.mockResolvedValue(
      new Headers({
        host: "tenant-a.localhost.test",
        "x-atlas-internal-cookie": "atlas_access_token=middleware-token",
      }),
    );
    mockFetch.mockResolvedValue(jsonResponse({ data: { ok: true } }));

    const { serverApi } = await import("../../../frontend/apps/web/src/lib/server-api");
    await serverApi.get("/api/v1/me");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("cookie")).toBe("atlas_access_token=middleware-token");
  });

  it("retries transient TENANT_NOT_FOUND responses", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "TENANT_NOT_FOUND",
              message: "Tenant not found",
              requestId: "req-1",
            },
          },
          { ok: false, status: 404 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    const { serverApi } = await import("../../../frontend/apps/web/src/lib/server-api");
    const result = await serverApi.get<{ data: { ok: boolean } }>("/api/v1/me");

    expect(result.data.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes session and retries once after a 401", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp: futureExp })).toString("base64url");
    const validAccessToken = `header.${payload}.signature`;

    mockCookies.mockResolvedValue({ getAll: () => [], get: () => undefined });
    mockHeaders.mockResolvedValue(
      new Headers({
        host: "tenant-a.localhost.test",
        "x-atlas-internal-cookie": `atlas_access_token=${validAccessToken}; atlas_refresh_token=refresh-token`,
      }),
    );

    let gamificationCalls = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/public/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          headers: {
            getSetCookie: () => ["atlas_access_token=fresh-token; Path=/; HttpOnly"],
          },
        };
      }

      if (url.includes("/api/v1/me/gamification")) {
        gamificationCalls += 1;
        if (gamificationCalls === 1) {
          return jsonResponse(
            {
              error: {
                code: "AUTH_REQUIRED",
                message: "Unauthorized",
                requestId: "req-auth",
              },
            },
            { ok: false, status: 401 },
          );
        }
        return jsonResponse({ data: { ok: true } });
      }

      return jsonResponse({ data: { ok: true } });
    });

    const { serverApi } = await import("../../../frontend/apps/web/src/lib/server-api");
    const result = await serverApi.get<{ data: { ok: boolean } }>("/api/v1/me/gamification");

    expect(result.data.ok).toBe(true);
    expect(gamificationCalls).toBe(2);
    expect(
      mockFetch.mock.calls.some(([calledUrl]) =>
        String(calledUrl).includes("/api/v1/public/auth/refresh"),
      ),
    ).toBe(true);

    const retryCall = mockFetch.mock.calls.find(([calledUrl]) =>
      String(calledUrl).includes("/api/v1/me/gamification"),
    );
    expect(retryCall).toBeTruthy();
  });

  it("throws ServerApiError for failed responses", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "PERMISSION_DENIED",
            message: "Denied",
            requestId: "req-1",
          },
        },
        { ok: false, status: 403 },
      ),
    );

    const { serverApi, ServerApiError } =
      await import("../../../frontend/apps/web/src/lib/server-api");

    await expect(serverApi.get("/api/v1/branding")).rejects.toBeInstanceOf(ServerApiError);
  });
});
