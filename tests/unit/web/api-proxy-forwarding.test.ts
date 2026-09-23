import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy as apiProxy } from "../../../backend/apps/api/src/proxy";
import { proxy as webProxy } from "../../../frontend/apps/web/src/proxy";
import { resolveRequestHostFromHeaders } from "../../../backend/packages/tenancy/src/host";

const key = "synthetic-api-proxy-credential-0123456789";
const proxyKeyHeader = "x-atlas-proxy-key";

function upstreamHeaders(response: Response): Headers {
  const result = new Headers();
  for (const [name, value] of response.headers) {
    if (name.startsWith("x-middleware-request-")) {
      result.set(name.slice("x-middleware-request-".length), value);
    }
  }
  return result;
}

function apiRequest(credential?: string) {
  return new NextRequest("https://api.example.com/api/v1/me", {
    headers: {
      host: "api.example.com",
      "x-atlas-tenant-host": "tenant.example.com",
      "x-forwarded-host": "tenant.example.com",
      ...(credential === undefined ? {} : { [proxyKeyHeader]: credential }),
    },
  });
}

describe("F11 authenticated web-to-API host forwarding", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("API_PROXY_SECRET", key);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("preserves an authenticated browser hostname across a separate API host", () => {
    const response = apiProxy(apiRequest(key));
    const forwarded = upstreamHeaders(response);

    expect(resolveRequestHostFromHeaders(forwarded)).toBe("tenant.example.com");
    expect(forwarded.get(proxyKeyHeader)).toBeNull();
    expect(response.headers.get(proxyKeyHeader)).toBeNull();
  });

  it.each([undefined, "wrong-key", "synthetic-api-proxy-credential-0123456788"])(
    "strips untrusted host overrides for credential %s",
    (credential) => {
      const forwarded = upstreamHeaders(apiProxy(apiRequest(credential)));

      expect(forwarded.get("x-atlas-tenant-host")).toBeNull();
      expect(forwarded.get("x-forwarded-host")).toBeNull();
      expect(forwarded.get(proxyKeyHeader)).toBeNull();
      expect(resolveRequestHostFromHeaders(forwarded)).toBe("api.example.com");
    },
  );

  it("fails closed for forwarded hosts when the deployed secret is missing", () => {
    vi.stubEnv("API_PROXY_SECRET", "");
    const forwarded = upstreamHeaders(apiProxy(apiRequest("")));

    expect(forwarded.get("x-atlas-tenant-host")).toBeNull();
    expect(forwarded.get("x-forwarded-host")).toBeNull();
    expect(forwarded.get(proxyKeyHeader)).toBeNull();
  });

  it("retains unsigned local forwarding only without a configured secret", () => {
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RELEASE_ENV", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("API_PROXY_SECRET", "");

    const forwarded = upstreamHeaders(apiProxy(apiRequest("client-value")));
    expect(resolveRequestHostFromHeaders(forwarded)).toBe("tenant.example.com");
    expect(forwarded.get(proxyKeyHeader)).toBeNull();
  });

  it("replaces client credentials and host overrides before web API rewrites", async () => {
    const response = await webProxy(
      new NextRequest("https://tenant.example.com/api/v1/me", {
        headers: {
          host: "tenant.example.com",
          [proxyKeyHeader]: "forged-key",
          "x-atlas-tenant-host": "victim.example.com",
          "x-forwarded-host": "victim.example.com",
        },
      }),
    );
    const forwarded = upstreamHeaders(response);

    expect(forwarded.get(proxyKeyHeader)).toBe(key);
    expect(forwarded.get("x-atlas-tenant-host")).toBe("tenant.example.com");
    expect(forwarded.get("x-forwarded-host")).toBe("tenant.example.com");
    expect(response.headers.get(proxyKeyHeader)).toBeNull();
  });

  it("does not pass a proxy credential to page rendering", async () => {
    const response = await webProxy(
      new NextRequest("https://tenant.example.com/login", {
        headers: {
          host: "tenant.example.com",
          [proxyKeyHeader]: "forged-key",
          "x-atlas-tenant-host": "victim.example.com",
          "x-forwarded-host": "victim.example.com",
        },
      }),
    );

    expect(upstreamHeaders(response).get(proxyKeyHeader)).toBeNull();
    expect(upstreamHeaders(response).get("x-atlas-tenant-host")).toBe("tenant.example.com");
    expect(upstreamHeaders(response).get("x-forwarded-host")).toBe("tenant.example.com");
  });

  it("refuses deployed web API forwarding when its secret is missing", async () => {
    vi.stubEnv("API_PROXY_SECRET", "");
    await expect(
      webProxy(
        new NextRequest("https://tenant.example.com/api/v1/me", {
          headers: { host: "tenant.example.com" },
        }),
      ),
    ).rejects.toThrow("API_PROXY_SECRET is required");
  });

  it("preserves binary upload bytes and session headers through the actual API ingress", async () => {
    const payload = new Uint8Array([0, 255, 127, 13, 10, 0]);
    const request = new NextRequest(
      "https://tenant.example.com/api/v1/lessons/lesson-1/assets/blob",
      {
        method: "POST",
        headers: {
          host: "tenant.example.com",
          cookie: "atlas_access_token=synthetic-session",
          "content-type": "application/octet-stream",
          "x-asset-reference-id": "asset-1",
          [proxyKeyHeader]: "forged-key",
        },
        body: payload,
      },
    );
    const forwarded = upstreamHeaders(await webProxy(request));
    expect(forwarded.get(proxyKeyHeader)).toBe(key);
    expect(forwarded.get("cookie")).toBe("atlas_access_token=synthetic-session");
    expect(forwarded.get("x-asset-reference-id")).toBe("asset-1");
    expect(forwarded.get("content-type")).toBe("application/octet-stream");
    expect(request.bodyUsed).toBe(false);
    expect(new Uint8Array(await request.arrayBuffer())).toEqual(payload);
    const backend = apiProxy(
      new NextRequest("https://api.example.com/api/v1/lessons/lesson-1/assets/blob", {
        headers: forwarded,
      }),
    );
    expect(resolveRequestHostFromHeaders(upstreamHeaders(backend))).toBe("tenant.example.com");
    expect(upstreamHeaders(backend).get(proxyKeyHeader)).toBeNull();
  });

  it("does not use the local exception on a hosted preview", () => {
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("API_PROXY_SECRET", "");
    vi.stubEnv("VERCEL", "1");

    expect(upstreamHeaders(apiProxy(apiRequest())).get("x-atlas-tenant-host")).toBeNull();
  });
});
