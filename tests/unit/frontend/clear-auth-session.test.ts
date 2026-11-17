import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  remove: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mocks.set, delete: mocks.remove }),
}));
vi.mock("../../../frontend/apps/web/src/lib/server/public-auth-fetch", () => ({
  serverPublicApi: { logout: () => mocks.logout() },
}));

import { clearAtlasAuthSession } from "../../../frontend/apps/web/src/lib/auth/clear-auth-session";

/**
 * Staging, 17 November 2026: after signing out, the session cookie stayed and
 * "Dashboard" still let the person in. `cookies().delete()` wrote no Secure,
 * which a browser needs to remove `__Secure-atlas_session`.
 */
describe("signing out on the web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logout.mockResolvedValue({ data: { ok: true } });
  });

  it("ends the session in the API, then clears both session cookies as a browser accepts", async () => {
    await clearAtlasAuthSession();

    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith(
      "__Secure-atlas_session",
      "",
      expect.objectContaining({ secure: true, maxAge: 0, path: "/", httpOnly: true }),
    );
    expect(mocks.set).toHaveBeenCalledWith(
      "atlas_session",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
  });

  it("still clears the cookies when the API can't be reached", async () => {
    mocks.logout.mockRejectedValue(new Error("unreachable"));
    await clearAtlasAuthSession();
    expect(mocks.set).toHaveBeenCalledTimes(2);
  });
});
