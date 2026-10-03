import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasSessionCookie } from "../../../frontend/apps/web/src/lib/server/has-session-cookie";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}));
beforeEach(() => jar.clear());

describe("session presence hint", () => {
  it("does not mistake an anonymous visitor's appearance cookie for a session", async () => {
    jar.set("atlas_ui_mode", "dark");
    jar.set("atlas_session_persistent", "true");
    expect(await hasSessionCookie()).toBe(false);
  });
  it("rejects absent and cleared tokens", async () => {
    expect(await hasSessionCookie()).toBe(false);
    jar.set("atlas_access_token", "");
    jar.set("atlas_refresh_token", "");
    expect(await hasSessionCookie()).toBe(false);
  });
  it.each(["atlas_access_token", "atlas_refresh_token"])(
    "returns only a boolean for %s, leaving verification to the API",
    async (name) => {
      jar.set(name, "unverified-session-value");
      expect(await hasSessionCookie()).toBe(true);
    },
  );
});
