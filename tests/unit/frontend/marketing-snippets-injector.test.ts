// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { MarketingSnippetsInjector } from "../../../frontend/apps/web/src/features/marketing/MarketingSnippetsInjector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const snippets = {
  siteBodyHtml: '<span id="site-body-ran"></span>',
  orderTrackingHtml: '<span id="order-ran"></span>',
  signupTrackingHtml: '<span id="signup-ran"></span>',
};

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ data: snippets }), { status: 200 })),
  );
  vi.stubGlobal("fetch", fetchMock);
  reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: Object.assign(new URL(window.location.href), { reload }),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.querySelectorAll("[id^=atlas-marketing-snippet]").forEach((node) => node.remove());
  vi.unstubAllGlobals();
});

async function visit(path: string) {
  navigation.pathname = path.split("?")[0] ?? path;
  const url = new URL(path, "https://academy.example.test");
  window.history.replaceState(null, "", url.pathname + url.search);
  Object.assign(window.location, { pathname: url.pathname, search: url.search, hash: url.hash });
  await act(async () => {
    root.render(createElement(MarketingSnippetsInjector));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("MarketingSnippetsInjector (audit H5)", () => {
  it("runs the site body snippet on public and learner pages", async () => {
    await visit("/courses");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/public/marketing/integrations/snippets",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(document.getElementById("site-body-ran")).not.toBeNull();
    expect(document.getElementById("signup-ran")).toBeNull();
  });

  it.each(["/admin", "/studio/courses", "/platform", "/login", "/signup", "/profile/security"])(
    "never even fetches snippets on %s",
    async (path) => {
      await visit(path);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(document.getElementById("site-body-ran")).toBeNull();
    },
  );

  it("reloads rather than carry injected code into a staff page", async () => {
    await visit("/courses");
    expect(reload).not.toHaveBeenCalled();
    await visit("/admin/roles");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload when nothing was injected", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: { siteBodyHtml: null, orderTrackingHtml: null, signupTrackingHtml: null },
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    await visit("/courses");
    await visit("/admin");
    expect(reload).not.toHaveBeenCalled();
  });

  it("fires signup tracking after signup completes, once, and strips the marker", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    await visit("/courses?signupComplete=1&tab=mine");
    expect(document.getElementById("signup-ran")).not.toBeNull();
    // The last URL written keeps other parameters and drops the marker.
    expect(replaceState.mock.calls.at(-1)?.[2]).toBe("/courses?tab=mine");
    replaceState.mockRestore();
  });

  it("fires order tracking on the checkout-success marker", async () => {
    await visit("/courses/abc?checkout=success");
    expect(document.getElementById("order-ran")).not.toBeNull();
  });
});
