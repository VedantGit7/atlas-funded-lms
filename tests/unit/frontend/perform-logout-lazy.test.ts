import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ loaded: false, events: [] as string[], failSignout: false }));
vi.mock("../../../frontend/apps/web/src/lib/supabase/browser", () => {
  state.loaded = true;
  return {
    createSupabaseBrowserClient: () => ({
      auth: {
        signOut: async () => {
          state.events.push("browser-signout");
          if (state.failSignout) throw new Error("offline");
        },
      },
    }),
  };
});
vi.mock("../../../frontend/apps/web/src/lib/auth/clear-auth-session", () => ({
  clearAtlasAuthSession: async () => {
    state.events.push("clear-server-cookies");
  },
}));
vi.mock("../../../frontend/apps/web/src/lib/query/client-data-cache", () => ({
  clearClientDataCache: () => {
    state.events.push("clear-client-cache");
  },
}));
import { performAtlasLogout } from "../../../frontend/apps/web/src/lib/auth/perform-logout";

describe("logout loads the browser auth SDK only on demand", () => {
  it("does not load the SDK while rendering a shell", () => {
    expect(state.loaded).toBe(false);
  });
  it("clears server cookies before browser signout, then clears cached tenant data", async () => {
    state.events = [];
    expect(await performAtlasLogout()).toBe("/login");
    expect(state.events).toEqual(["clear-server-cookies", "browser-signout", "clear-client-cache"]);
  });
  it("still clears cached data when best-effort browser signout fails", async () => {
    state.events = [];
    state.failSignout = true;
    expect(await performAtlasLogout({ redirectTo: "/" })).toBe("/");
    expect(state.events).toEqual(["clear-server-cookies", "browser-signout", "clear-client-cache"]);
  });
});
