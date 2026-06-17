import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHeaders = vi.fn();
const mockCookies = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}));

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
    });
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
  });

  it("forwards cookies and returns JSON for successful GET requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { displayName: "Atlas Tenant" } }),
    });

    const { serverApi } = await import("../../../apps/web/src/lib/server-api");

    const result = await serverApi.get<{ data: { displayName: string } }>("/api/v1/branding");

    expect(result.data.displayName).toBe("Atlas Tenant");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://tenant-a.localhost.test/api/v1/branding");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("cookie")).toBe("atlas_access_token=token-123");
  });

  it("throws ServerApiError for failed responses", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: "PERMISSION_DENIED",
          message: "Denied",
          requestId: "req-1",
        },
      }),
    });

    const { serverApi, ServerApiError } = await import("../../../apps/web/src/lib/server-api");

    await expect(serverApi.get("/api/v1/branding")).rejects.toBeInstanceOf(ServerApiError);
  });
});
