import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ motionLoads: 0 }));
vi.mock("../../../frontend/apps/web/src/components/motion/animation-boundary", () => {
  state.motionLoads += 1;
  return { AnimatePresence: "presence", motion: { div: "div" }, useReducedMotion: () => true };
});
it("does not load the general animation renderer for the resource filter disclosure", async () => {
  await import("../../../frontend/apps/web/src/features/resources/ResourceLibrary");
  expect(state.motionLoads).toBe(0);
});
