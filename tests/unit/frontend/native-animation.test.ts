// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement, useRef } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import {
  useEntryAnimation,
  useAnimatedNumber,
} from "../../../frontend/apps/web/src/components/motion/native-animation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement("div");
document.body.append(container);
let root = createRoot(container);
let reduced = false;
let preferenceChanged: () => void;
let intersect: IntersectionObserverCallback;
const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel, finish: vi.fn() }));
vi.stubGlobal("matchMedia", () => ({
  get matches() {
    return reduced;
  },
  addEventListener: (_: string, callback: () => void) => {
    preferenceChanged = callback;
  },
  removeEventListener: vi.fn(),
}));
vi.stubGlobal(
  "IntersectionObserver",
  class {
    constructor(callback: IntersectionObserverCallback) {
      intersect = callback;
    }
    observe() {}
    disconnect() {}
  },
);
Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
function Entry() {
  const ref = useRef<HTMLDivElement>(null);
  useEntryAnimation(
    ref,
    [
      { opacity: 0, transform: "translateY(20px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 550, threshold: 0.2 },
  );
  return createElement("div", { ref }, "Content remains in the initial HTML");
}
function Counter({ value }: { value: number }) {
  return createElement("span", null, useAnimatedNumber(value, 1100));
}
afterEach(async () => {
  await act(() => root.unmount());
  root = createRoot(container);
  reduced = false;
  vi.clearAllMocks();
  vi.useRealTimers();
});
it("starts once at the viewport threshold and cancels when reduced motion is requested", async () => {
  await act(() => root.render(createElement(Entry)));
  expect(container.textContent).toContain("initial HTML");
  expect(animate).not.toHaveBeenCalled();
  const notify = (ratio: number) =>
    intersect(
      [{ isIntersecting: true, intersectionRatio: ratio } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  notify(0.1);
  expect(animate).not.toHaveBeenCalled();
  notify(0.2);
  notify(0.8);
  expect(animate).toHaveBeenCalledTimes(1);
  reduced = true;
  preferenceChanged();
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("keeps entry content static under reduced motion", async () => {
  reduced = true;
  await act(() => root.render(createElement(Entry)));
  expect(animate).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Content");
});
it("animates the count to its target and responds immediately under reduced motion", async () => {
  vi.useFakeTimers();
  await act(() => root.render(createElement(Counter, { value: 74 })));
  expect(container.textContent).toBe("0");
  await act(() => vi.advanceTimersByTime(1200));
  expect(container.textContent).toBe("74");
  reduced = true;
  await act(() => root.render(createElement(Counter, { value: 92 })));
  expect(container.textContent).toBe("92");
});
