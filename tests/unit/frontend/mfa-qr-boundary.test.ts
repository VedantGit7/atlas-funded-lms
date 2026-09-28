// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const state = vi.hoisted(() => ({
  sanitizerLoads: 0,
  get: vi.fn(async () => ({ data: { factors: [] } })),
  post: vi.fn(async () => ({
    data: {
      factorId: "factor-1",
      secret: "setup-secret",
      qrCode: '<svg onload="alert(1)"><script>alert(1)</script><path d="M0 0h10v10z"/></svg>',
    },
  })),
}));
vi.mock("../../../frontend/apps/web/src/components/SafeHtml", async (importOriginal) => {
  state.sanitizerLoads += 1;
  return importOriginal();
});
vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  ClientApiError: class extends Error {},
  clientApi: { get: state.get, post: state.post },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("loads QR sanitization on enrollment and still removes unsafe SVG content", async () => {
  const { MfaManager } =
    await import("../../../frontend/apps/web/src/features/account-security/MfaManager");
  expect(state.sanitizerLoads).toBe(0);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(() => root.render(createElement(MfaManager)));
    expect(container.textContent).toContain("Two-factor authentication");
    expect(state.sanitizerLoads).toBe(0);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
      await vi.dynamicImportSettled();
    });
    expect(state.sanitizerLoads).toBe(1);
    expect(state.post).toHaveBeenCalledWith("/api/v1/me/security/mfa", {}, "mfa-enroll");
    expect(container.querySelector("svg path[d='M0 0h10v10z']")).not.toBeNull();
    expect(container.querySelector("script, svg[onload]")).toBeNull();
    expect(container.textContent).toContain("setup-secret");
  } finally {
    await act(() => root.unmount());
  }
});
