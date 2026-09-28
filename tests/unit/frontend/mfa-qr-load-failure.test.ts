// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const api = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(async () => ({ data: { factors: [] } })),
}));
vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  ClientApiError: class extends Error {},
  clientApi: api,
}));
vi.mock("../../../frontend/apps/web/src/features/account-security/MfaQrCode", () => {
  throw new Error("QR renderer unavailable");
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("does not enroll without the QR renderer and unlocks the control for retry", async () => {
  const { MfaManager } =
    await import("../../../frontend/apps/web/src/features/account-security/MfaManager");
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(() => root.render(createElement(MfaManager)));
    const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await act(async () => {
        toggle?.click();
        await vi.dynamicImportSettled();
      });
      expect(api.post).not.toHaveBeenCalled();
      expect(toggle?.disabled).toBe(false);
      expect(container.textContent).toContain("Something went wrong. Please try again.");
      expect(container.querySelector("form")).toBeNull();
    }
  } finally {
    await act(() => root.unmount());
  }
});
