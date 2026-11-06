import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * Launch plan 5.1 (staging, 6 November 2026): a tenant admin calling a
 * platform route got 400 "Platform reason is required." or a query validation
 * error before the 403. The caller must be refused before any input is read,
 * so a non-operator learns nothing about a route's inputs.
 */

const mocks = vi.hoisted(() => ({ principal: vi.fn(), handler: vi.fn() }));
vi.mock("@atlas/auth/platform-auth", () => ({ requirePlatformPrincipal: mocks.principal }));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db", () => ({
  PlatformScopeError: class extends Error {},
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: object) => unknown) => fn({}),
}));
import { createPlatformRoute } from "@atlas/api/create-platform-route";

const route = createPlatformRoute({
  metadata: {
    permission: "platform.tenant.manage",
    audit: "required",
    idempotency: "required",
    reasonRequired: true,
    rateLimit: "platformWrite",
  },
  body: z.object({ value: z.number() }),
  output: z.object({ ok: z.boolean() }),
  handler: mocks.handler,
});

// No reason header, no idempotency key and a body that fails validation.
function malformedRequest() {
  return new NextRequest("https://platform.example.test/api/v1/platform/action", {
    method: "POST",
    headers: {
      host: "platform.example.test",
      origin: "https://platform.example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ value: "not-a-number" }),
  });
}

describe("platform routes refuse the caller before reading input", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.handler.mockResolvedValue({ ok: true });
  });

  it("answers a tenant admin with 403, not a validation error", async () => {
    mocks.principal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await route(malformedRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("answers an anonymous caller with 401, not a validation error", async () => {
    mocks.principal.mockRejectedValue(
      new AtlasHttpError({
        code: "AUTH_REQUIRED",
        status: 401,
        message: "Authentication required",
      }),
    );

    const response = await route(malformedRequest());

    expect(response.status).toBe(401);
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("still tells an operator what's missing", async () => {
    mocks.principal.mockResolvedValue({
      platformPrincipalId: "operator-a",
      platformPermissions: ["platform.tenant.manage"],
    });

    const response = await route(malformedRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(mocks.handler).not.toHaveBeenCalled();
  });
});
