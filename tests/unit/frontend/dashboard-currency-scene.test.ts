// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import { CurrencyProvider } from "../../../frontend/apps/web/src/features/currency/CurrencyProvider";
import { HeroSceneMount } from "../../../frontend/apps/web/src/features/learner/components/dashboard/dashboard-ui";

vi.mock("../../../frontend/apps/web/node_modules/next/dynamic", () => ({
  default:
    () =>
    ({ usdInr }: { usdInr: number | null }) =>
      createElement("span", null, String(usdInr)),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}));

it("keeps the scene subscribed to live currency updates after moving dashboard content to the server", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const children: ReactNode = createElement(HeroSceneMount, { color: "#22aa55" });
  const render = (rate: number) =>
    createElement(CurrencyProvider, { initialFxRates: { USD: 1, INR: rate }, children });
  try {
    await act(() => root.render(render(86)));
    expect(container.textContent).toBe("86");
    await act(() => root.render(render(89)));
    expect(container.textContent).toBe("89");
  } finally {
    await act(() => root.unmount());
  }
});
