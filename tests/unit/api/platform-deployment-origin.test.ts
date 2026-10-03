import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { validateDeploymentConfiguration } from "@atlas/core/config/deployment-contract";
import { deploymentEnv } from "../../helpers/deployment-env";

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  handler: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({ requirePlatformPrincipal: mocks.principal }));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db", () => ({
  PlatformScopeError: class extends Error {},
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: object) => unknown) => fn({}),
}));
vi.mock("../../../backend/packages/api/src/rate-limit", () => ({
  enforceIngressRateLimit: vi.fn(),
  enforceProtectedRateLimit: vi.fn(),
}));

import { createPlatformRoute } from "@atlas/api/create-platform-route";

const route = createPlatformRoute({
  metadata: {
    permission: "platform.tenant.manage",
    audit: "required",
    idempotency: "none",
    rateLimit: "platformWrite",
  },
  output: z.object({ ok: z.boolean() }),
  handler: mocks.handler,
});

function request(origin: string, host = "api.example.com", forwardedHost = "platform.example.com") {
  return new NextRequest(`https://${host}/api/v1/platform/action`, {
    method: "POST",
    headers: {
      host,
      origin,
      "x-atlas-tenant-host": forwardedHost,
      "x-forwarded-host": forwardedHost,
    },
  });
}

describe("F11 platform origin across separate web and API deployments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PLATFORM_HOST", "platform.example.com");
    mocks.principal.mockResolvedValue({
      platformPrincipalId: "operator-a",
      platformPermissions: ["platform.tenant.manage"],
    });
    mocks.handler.mockResolvedValue({ ok: true });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("accepts the configured browser origin when the API transport host differs", async () => {
    const response = await route(request("https://platform.example.com"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.principal).toHaveBeenCalledOnce();
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it.each(["tenant.example.com", "api.example.com"])(
    "rejects origin %s even when forwarded headers are forged to match it",
    async (host) => {
      const response = await route(request(`https://${host}`, "api.example.com", host));

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
      expect(mocks.principal).not.toHaveBeenCalled();
      expect(mocks.handler).not.toHaveBeenCalled();
    },
  );

  it("ignores spoofed tenant headers for a valid configured platform origin", async () => {
    const response = await route(
      request("https://platform.example.com", "api.example.com", "tenant.example.com"),
    );

    expect(response.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it("keeps the local Host fallback when PLATFORM_HOST is unconfigured", async () => {
    vi.stubEnv("PLATFORM_HOST", "");

    const response = await route(
      request("http://platform.localhost:3000", "platform.localhost:3001"),
    );

    expect(response.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it.each(["", "https://platform.example.com", "platform.example.com/path"])(
    "rejects deployed PLATFORM_HOST=%s through the startup contract",
    (PLATFORM_HOST) => {
      expect(() =>
        validateDeploymentConfiguration({ ...deploymentEnv(), PLATFORM_HOST }, "api"),
      ).toThrow(/PLATFORM_HOST/);
    },
  );
});
