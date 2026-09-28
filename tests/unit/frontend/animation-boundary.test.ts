// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement, createRef } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import {
  AnimatePresence,
  motion,
} from "../../../frontend/apps/web/src/components/motion/animation-boundary";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}));
it("preserves DOM refs, accessible attributes and presence exits without extra elements", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const ref = createRef<HTMLDivElement>();
  const render = (open: boolean) =>
    createElement(
      AnimatePresence,
      {},
      open
        ? createElement(
            motion.div,
            {
              key: "dialog",
              ref,
              role: "dialog",
              "aria-label": "Share certificate",
              initial: false,
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0 },
            },
            "Share",
          )
        : null,
    );
  try {
    await act(() => root.render(render(true)));
    expect(container.children).toHaveLength(1);
    expect(ref.current).toBe(container.firstElementChild);
    expect(ref.current?.getAttribute("aria-label")).toBe("Share certificate");
    await act(() => root.render(render(false)));
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(container.children).toHaveLength(0);
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
