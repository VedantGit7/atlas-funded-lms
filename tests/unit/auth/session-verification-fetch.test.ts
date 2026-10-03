import { describe, expect, it, vi } from "vitest";
import { sessionVerificationFetch } from "../../../backend/packages/auth/src/session-verification-fetch";

const endpoint = "https://auth.example.test/auth/v1/user";
const options = { headers: { authorization: "Bearer token-a", apikey: "key-a" } };

describe("single-verification response reuse", () => {
  it("reuses a consumable clone exactly once then performs another live request", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ id: "a" }));
    const fetcher = sessionVerificationFetch(endpoint, transport);
    expect(await (await fetcher(endpoint, options)).json()).toEqual({ id: "a" });
    expect(await (await fetcher(endpoint, options)).json()).toEqual({ id: "a" });
    expect(transport).toHaveBeenCalledTimes(1);
    await fetcher(endpoint, options);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0]?.[1]?.cache).toBe("no-store");
  });

  it.each([
    { headers: { authorization: "Bearer token-b", apikey: "key-a" } },
    { headers: { authorization: "Bearer token-a", apikey: "key-b" } },
    { headers: { ...options.headers, "x-extra": "different" } },
  ])("never shares a response across different headers (%j)", async (changed) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ id: "a" }));
    const fetcher = sessionVerificationFetch(endpoint, transport);
    await fetcher(endpoint, options);
    await fetcher(endpoint, changed);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([
    [endpoint, { ...options, method: "POST" }],
    [`${endpoint}?different=true`, options],
    ["https://another.example.test/auth/v1/user", options],
    ["https://auth.example.test/auth/v1/.well-known/jwks.json", options],
  ] as const)("does not reuse other methods or endpoints (%s)", async (url, init) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ id: "a" }));
    const fetcher = sessionVerificationFetch(endpoint, transport);
    await fetcher(url, init);
    await fetcher(url, init);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([401, 429, 500, 503])("never retains failed HTTP %s responses", async (status) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status }));
    const fetcher = sessionVerificationFetch(endpoint, transport);
    await fetcher(endpoint, options);
    await fetcher(endpoint, options);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("does not retain network failures", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network unavailable"));
    const fetcher = sessionVerificationFetch(endpoint, transport);
    await expect(fetcher(endpoint, options)).rejects.toThrow("network unavailable");
    await expect(fetcher(endpoint, options)).rejects.toThrow("network unavailable");
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
