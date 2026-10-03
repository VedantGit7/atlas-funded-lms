import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ runtimeLoads: 0 }));
vi.mock("../../../frontend/apps/web/src/features/marketing/MarketingCtaRuntime", () => {
  state.runtimeLoads += 1;
  return { MarketingCtaRuntime: "marketing-runtime" };
});

it("keeps the public shell's initial content independent of the post-hydration CTA runtime", async () => {
  const { PublicSiteShell } =
    await import("../../../frontend/apps/web/src/components/shells/PublicSiteShell");
  expect(state.runtimeLoads).toBe(0);
  const shell = PublicSiteShell({
    publicName: "Academy",
    children: "Page content",
    variant: "landing",
  });
  expect(shell.props.children[1].props.children).toBe("Page content");
  expect(shell.props.children[2].props.isAuthenticated).toBe(false);
});
