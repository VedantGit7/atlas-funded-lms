// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const state = vi.hoisted(() => ({ imageRuntimeLoads: 0 }));
vi.mock("../../../frontend/apps/web/node_modules/next/image", () => {
  state.imageRuntimeLoads += 1;
  return { default: "next-image" };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("renders unoptimized tenant logos without the Next image runtime, retaining theme and image props", async () => {
  const { TenantLogo } =
    await import("../../../frontend/packages/design-system/src/components/tenant-logo");
  const { TenantBrandMark } =
    await import("../../../frontend/apps/web/src/components/patterns/TenantBrandMark");
  expect(state.imageRuntimeLoads).toBe(0);
  const container = document.createElement("div");
  const root = createRoot(container);
  const loaded = vi.fn();
  try {
    await act(() =>
      root.render(
        createElement(TenantLogo, {
          publicName: "Example Academy",
          logoLightUrl: "https://cdn.example.test/light.svg?token=signed",
          logoDarkUrl: "https://cdn.example.test/dark.svg?token=signed",
          width: 150,
          height: 40,
          imageProps: { loading: "eager", decoding: "sync", onLoad: loaded },
        }),
      ),
    );
    let logo = container.querySelector("img");
    expect(logo?.getAttribute("src")).toBe("https://cdn.example.test/light.svg?token=signed");
    expect(logo?.getAttribute("alt")).toBe("Example Academy");
    expect(logo?.getAttribute("width")).toBe("150");
    expect(logo?.getAttribute("height")).toBe("40");
    expect(logo?.getAttribute("loading")).toBe("eager");
    expect(logo?.getAttribute("decoding")).toBe("sync");
    await act(() => logo?.dispatchEvent(new Event("load")));
    expect(loaded).toHaveBeenCalledOnce();
    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });
    expect(logo?.getAttribute("src")).toBe("https://cdn.example.test/dark.svg?token=signed");
    await act(() => root.render(createElement(TenantLogo, { publicName: "No Logo Academy" })));
    expect(container.textContent).toBe("No Logo Academy");
    await act(() =>
      root.render(
        createElement(TenantBrandMark, {
          logoUrl: "https://cdn.example.test/mark.svg",
          name: "Example",
          size: 32,
        }),
      ),
    );
    logo = container.querySelector("img");
    expect(logo?.getAttribute("alt")).toBe("");
    expect(logo?.getAttribute("width")).toBe("32");
    expect(logo?.getAttribute("loading")).toBe("lazy");
    expect(logo?.getAttribute("decoding")).toBe("async");
  } finally {
    await act(() => root.unmount());
    document.documentElement.classList.remove("dark");
  }
});
