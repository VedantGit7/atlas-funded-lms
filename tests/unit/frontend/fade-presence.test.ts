// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, StrictMode } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import { renderToString } from "../../../frontend/apps/web/node_modules/react-dom/server";
import { FadePresence } from "../../../frontend/apps/web/src/components/motion/FadePresence";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let reduced = false;
const listeners = new Set<() => void>();
type AnimationStub = { onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> };
const animations: AnimationStub[] = [];
const animate = vi.fn(() => {
  const animation: AnimationStub = { onfinish: null, cancel: vi.fn() };
  animations.push(animation);
  return animation;
});
const container = document.createElement("div");
document.body.append(container);
let root = createRoot(container);
const panel = (open: boolean) =>
  createElement(FadePresence, {
    open,
    offset: -4,
    duration: 180,
    children: createElement("button", null, "Reply"),
  });

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
});
afterEach(async () => {
  await act(() => root.unmount());
  root = createRoot(container);
  reduced = false;
  animations.length = 0;
  listeners.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("server-renders expanded content, with no hidden initial styles or extra wrappers", async () => {
  expect(renderToString(panel(true))).toContain("<button>Reply</button>");
  expect(renderToString(panel(false))).toBe("");
  await act(() => root.render(panel(true)));
  expect(container.children).toHaveLength(1);
  expect(container.firstElementChild?.hasAttribute("inert")).toBe(false);
  expect(animate).not.toHaveBeenCalled();
});

it("does not animate initially expanded content during Strict Mode effect replay", async () => {
  await act(() => root.render(createElement(StrictMode, null, panel(true))));
  expect(container.textContent).toBe("Reply");
  expect(animate).not.toHaveBeenCalled();
});

it("animates opening and retains an inert panel only until its exit completes", async () => {
  await act(() => root.render(panel(false)));
  await act(() => root.render(panel(true)));
  expect(animate).toHaveBeenCalledWith(
    [
      { opacity: 0, transform: "translateY(-4px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    expect.objectContaining({ duration: 180 }),
  );
  await act(() => root.render(panel(false)));
  expect(container.firstElementChild?.hasAttribute("inert")).toBe(true);
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  await act(() => animations.at(-1)?.onfinish?.());
  expect(container.children).toHaveLength(0);
});

it("ignores a stale exit completion when the learner reopens the panel", async () => {
  await act(() => root.render(panel(true)));
  await act(() => root.render(panel(false)));
  const staleFinish = animations.at(-1)?.onfinish;
  await act(() => root.render(panel(true)));
  await act(() => staleFinish?.());
  expect(container.textContent).toBe("Reply");
  expect(container.firstElementChild?.hasAttribute("inert")).toBe(false);
});

it("opens and closes immediately under reduced motion", async () => {
  reduced = true;
  await act(() => root.render(panel(false)));
  await act(() => root.render(panel(true)));
  expect(container.textContent).toBe("Reply");
  await act(() => root.render(panel(false)));
  expect(container.children).toHaveLength(0);
  expect(animate).not.toHaveBeenCalled();
});

it("settles an exit immediately if reduced motion is requested during animation", async () => {
  await act(() => root.render(panel(true)));
  await act(() => root.render(panel(false)));
  reduced = true;
  await act(() => listeners.forEach((listener) => listener()));
  expect(container.children).toHaveLength(0);
  expect(animations.at(-1)?.cancel).toHaveBeenCalled();
});

it("keeps disclosure usable when the browser has no Web Animations API", async () => {
  Element.prototype.animate = undefined as unknown as typeof Element.prototype.animate;
  await act(() => root.render(panel(false)));
  await act(() => root.render(panel(true)));
  expect(container.textContent).toBe("Reply");
  await act(() => root.render(panel(false)));
  expect(container.children).toHaveLength(0);
});

it("measures the natural height for expanding filters and restores natural layout after animation", async () => {
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(180);
  const filter = (open: boolean) =>
    createElement(FadePresence, { open, collapse: true, children: "Filters" });
  await act(() => root.render(filter(false)));
  await act(() => root.render(filter(true)));
  expect(animate).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ height: "0px" }),
      expect.objectContaining({ height: "180px" }),
    ]),
    expect.anything(),
  );
  expect((container.firstElementChild as HTMLElement).style.height).toBe("");
});
