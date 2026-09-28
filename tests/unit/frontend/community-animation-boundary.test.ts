import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ motionLoads: 0 }));
vi.mock("../../../frontend/apps/web/src/components/motion/animation-boundary", () => {
  state.motionLoads += 1;
  return { AnimatePresence: "presence", motion: { div: "div" }, useReducedMotion: () => true };
});

it("renders community comments without importing the general motion renderer", async () => {
  await import("../../../frontend/apps/web/src/features/community/components/PostCard");
  await import("../../../frontend/apps/web/src/features/community/components/CommentTree");
  expect(state.motionLoads).toBe(0);
});
