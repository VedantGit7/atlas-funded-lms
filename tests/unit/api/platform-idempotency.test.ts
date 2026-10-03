import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  handler: vi.fn(),
  record: null as Record<string, unknown> | null,
  query: vi.fn(),
}));
vi.mock("@atlas/auth/platform-auth", () => ({ requirePlatformPrincipal: mocks.principal }));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: (fn: (db: object) => unknown) => fn({}) }));
vi.mock("@atlas/db", () => ({
  PlatformScopeError: class extends Error {},
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: object) => unknown) =>
    fn({
      $queryRaw: mocks.query,
      $executeRaw: async (_sql: unknown, ...values: unknown[]) => {
        if (mocks.record)
          Object.assign(mocks.record, {
            status: "COMPLETED",
            response_json: JSON.parse(values[0] as string),
            response_omitted: values[1],
          });
        return 1;
      },
    }),
}));
import { createPlatformRoute } from "@atlas/api/create-platform-route";

function request(value = 1, key = "platform-key") {
  return new NextRequest("https://platform.example.test/api/v1/platform/action", {
    method: "POST",
    headers: {
      host: "platform.example.test",
      origin: "https://platform.example.test",
      "content-type": "application/json",
      "idempotency-key": key,
      "x-atlas-platform-reason": "Verify operator retry safety",
    },
    body: JSON.stringify({ value }),
  });
}
function route() {
  return createPlatformRoute({
    metadata: {
      permission: "platform.tenant.manage",
      audit: "required",
      idempotency: "required",
      reasonRequired: true,
      rateLimit: "platformWrite",
    },
    body: z.object({ value: z.number() }),
    output: z.object({ result: z.string() }),
    handler: mocks.handler,
  });
}
describe("F03 platform wrapper retries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.record = null;
    mocks.principal.mockResolvedValue({
      platformPrincipalId: "operator-a",
      platformPermissions: ["platform.tenant.manage"],
    });
    mocks.handler.mockResolvedValue({ result: "original" });
    mocks.query.mockImplementation(async (sql: TemplateStringsArray, ...values: unknown[]) => {
      if (sql.join("").includes("INSERT INTO")) {
        if (mocks.record) return [];
        mocks.record = {
          id: "record-p",
          status: "IN_PROGRESS",
          actor_principal_id: values[1],
          scope: values[2],
          request_fingerprint: values[4],
          replay_valid: true,
        };
        return [{ id: "record-p" }];
      }
      return mocks.record ? [mocks.record] : [];
    });
  });
  it("authorizes every retry and executes the mutation once", async () => {
    const run = route();
    expect((await run(request())).status).toBe(200);
    expect((await run(request())).status).toBe(200);
    expect(mocks.principal).toHaveBeenCalledTimes(2);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });
  it.each(["actor", "body"])("rejects a changed %s for an existing key", async (change) => {
    const run = route();
    expect((await run(request())).status).toBe(200);
    if (change === "actor")
      mocks.principal.mockResolvedValue({
        platformPrincipalId: "operator-b",
        platformPermissions: ["platform.tenant.manage"],
      });
    const retry = await run(request(change === "body" ? 2 : 1));
    expect(retry.status).toBe(422);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });
  it.each(["PERMISSION_DENIED", "MFA_REQUIRED"] as const)(
    "does not replay after %s",
    async (code) => {
      const run = route();
      expect((await run(request())).status).toBe(200);
      mocks.principal.mockRejectedValue(
        new AtlasHttpError({ code, status: 403, message: "Access denied" }),
      );
      const retry = await run(request());
      expect(retry.status).toBe(403);
      expect(mocks.handler).toHaveBeenCalledOnce();
    },
  );
  it("rejects oversized keys before invoking the mutation", async () => {
    expect((await route()(request(1, "a".repeat(257)))).status).toBe(400);
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it.each([
    ["scope", { scope: "DELETE /api/v1/platform/action" }, 422],
    ["expiration", { replay_valid: false }, 409],
    ["in-progress claim", { status: "IN_PROGRESS" }, 409],
    ["omitted response", { response_omitted: true }, 409],
  ])("rejects replay with changed %s", async (_label, changes, status) => {
    const run = route();
    expect((await run(request())).status).toBe(200);
    Object.assign(mocks.record ?? {}, changes);
    expect((await run(request())).status).toBe(status);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it("does not repeat a mutation when the conflicting claim disappears", async () => {
    const run = route();
    expect((await run(request())).status).toBe(200);
    mocks.query.mockResolvedValue([]);
    expect((await run(request())).status).toBe(409);
    expect(mocks.handler).toHaveBeenCalledOnce();
  });
});
