import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";

const mocks = vi.hoisted(() => ({
  requirePlatformPrincipal: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mocks.requirePlatformPrincipal(...args),
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() }),
}));
vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: mocks.queryRaw }),
}));

import { GET } from "../../backend/apps/api/src/app/api/v1/platform/shell/route";

function request() {
  return new NextRequest("https://platform.example.com/api/v1/platform/shell", {
    headers: { host: "platform.example.com", authorization: "Bearer platform-token" },
  });
}

describe("GET /api/v1/platform/shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("describes the operator and what their grant allows", async () => {
    mocks.requirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
      platformPermissions: ["platform.tenant.read", "platform.tenant.manage"],
    });
    mocks.queryRaw.mockResolvedValue([{ email: "operator@example.test", mfa_enabled: true }]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        email: "operator@example.test",
        mfaEnabled: true,
        platformPermissions: ["platform.tenant.read", "platform.tenant.manage"],
      },
    });
  });

  // The console's gate offers MFA setup only when it can read MFA_REQUIRED.
  // Before this route used the platform route factory, any refusal escaped
  // as an unhandled error and answered 500, so the gate showed "denied".
  it.each([
    ["MFA_REQUIRED", "Platform access requires multi-factor authentication."],
    ["PERMISSION_DENIED", "Platform access denied."],
  ])("answers a %s refusal as a 403 with its code", async (code, message) => {
    mocks.requirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({ code, status: 403, message }),
    );

    const response = await GET(request());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(code);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });
});
