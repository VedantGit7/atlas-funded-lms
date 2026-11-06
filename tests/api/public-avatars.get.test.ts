import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan 5.1 (staging, 6 November 2026): without a public R2 endpoint,
 * avatars had no address and never showed. Profiles now store this route,
 * which redirects to a short-lived signed URL.
 */

const mocks = vi.hoisted(() => ({ sign: vi.fn(), tenantTx: vi.fn() }));

vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveRequestTenant: () =>
    Promise.resolve({ tenantId: "018f0000-0000-7000-8000-000000000001", requestId: "r" }),
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => {
    mocks.tenantTx(ctx);
    return fn({});
  },
}));
vi.mock("@atlas/storage/member-avatar.service", () => ({
  signMemberAvatarDownload: (...args: unknown[]) => mocks.sign(...args),
}));

import { GET } from "../../backend/apps/api/src/app/api/v1/public/avatars/[id]/route";

const avatarId = "018f0000-0000-7000-8000-0000000000a7";
const get = (id: string) =>
  GET(
    new NextRequest(`https://academy.example.test/api/v1/public/avatars/${id}`, {
      headers: { host: "academy.example.test" },
    }),
  );

describe("GET /api/v1/public/avatars/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to a signed URL for the academy's avatar, cached briefly", async () => {
    mocks.sign.mockResolvedValue(
      "https://acct.r2.cloudflarestorage.com/atlas-assets/a.png?X-Amz-Signature=x",
    );

    const response = await get(avatarId);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://acct.r2.cloudflarestorage.com/atlas-assets/a.png?X-Amz-Signature=x",
    );
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(mocks.sign).toHaveBeenCalledWith(expect.anything(), avatarId);
    expect(mocks.tenantTx).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "018f0000-0000-7000-8000-000000000001" }),
    );
  });

  it("answers 404 for an avatar it can't serve", async () => {
    mocks.sign.mockResolvedValue(null);

    const response = await get(avatarId);

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("answers 404 for something that isn't an avatar id, without a lookup", async () => {
    const response = await get("not-a-uuid");

    expect(response.status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
