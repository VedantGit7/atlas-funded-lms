// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  createElement,
  type ComponentProps,
} from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import { renderToString } from "../../../frontend/apps/web/node_modules/react-dom/server";
import { AtlasPlatformLanding } from "../../../frontend/apps/web/src/features/public/components/atlas-landing/AtlasPlatformLanding";
import { TenantPublicLanding } from "../../../frontend/apps/web/src/features/public/components/landing/TenantPublicLanding";

const analytics = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock(
  "../../../frontend/apps/web/src/features/public/components/landing/landing-analytics",
  () => ({
    captureLandingCtaClick: analytics.capture,
  }),
);
vi.mock("../../../frontend/apps/web/node_modules/next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => createElement("a", props, children),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}));
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const landing = {
  publicName: "Example Academy",
  headline: "Learn to Trade",
  subheadline: "Build lasting habits",
  primaryCta: { label: "Start diagnostic", href: "/diagnostic" },
  footerText: "Example footer",
} as ComponentProps<typeof TenantPublicLanding>["landing"];

it("renders the complete platform content on the server and retains theme switching", async () => {
  const page = createElement(AtlasPlatformLanding);
  const html = renderToString(page);
  expect(html).toContain("Launch your own learning platform");
  expect(html).toContain("Built for multi-tenant, white-label delivery.");
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(() => root.render(page));
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Switch to dark mode"]');
    expect(toggle).not.toBeNull();
    await act(() => toggle?.click());
    expect(container.firstElementChild?.classList.contains("atl-dark")).toBe(true);
    expect(localStorage.getItem("atlas-landing-dark")).toBe("true");
    expect(container.textContent).toContain("Launch your own learning platform");
  } finally {
    await act(() => root.unmount());
  }
});

it("retains tenant content, authenticated navigation, CTA attribution, theme and FAQ controls", async () => {
  const page = createElement(TenantPublicLanding, {
    landing,
    authCta: { label: "Dashboard", href: "/admin" },
  });
  const html = renderToString(page);
  expect(html).toContain("Build lasting habits");
  expect(html).toContain("Example footer");
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(() => root.render(page));
    expect(container.querySelector('a[href="/admin"]')?.textContent).toBe("Dashboard");
    const cta = [...container.querySelectorAll("a")].find(
      (item) => item.textContent === "Start diagnostic",
    );
    cta?.addEventListener("click", (event) => event.preventDefault());
    await act(() => cta?.click());
    expect(analytics.capture).toHaveBeenCalledWith("hero_primary_cta");
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Switch to dark mode"]');
    expect(toggle).not.toBeNull();
    await act(() => toggle?.click());
    expect(container.firstElementChild?.classList.contains("fba-dark")).toBe(true);
    const faq = container.querySelector<HTMLButtonElement>("#faq button");
    expect(faq?.getAttribute("aria-expanded")).toBe("false");
    await act(() => faq?.click());
    expect(faq?.getAttribute("aria-expanded")).toBe("true");
  } finally {
    await act(() => root.unmount());
  }
});
