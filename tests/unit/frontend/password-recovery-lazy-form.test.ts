// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import {
  act,
  Component,
  createElement,
  Profiler,
  type ReactNode,
} from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

vi.mock(
  "../../../frontend/apps/web/src/app/(auth)/reset-password/_actions/reset-password-action",
  () => ({
    completePasswordResetAction: vi.fn(),
    requestPasswordResetAction: vi.fn(),
  }),
);
import { PasswordResetForm } from "../../../frontend/apps/web/src/app/(auth)/reset-password/_components/PasswordResetForm";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
class RecoveryBoundary extends Component<{ children?: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed
      ? createElement("p", null, "Recovery render loop")
      : this.props.children;
  }
}

it("mounts the actual reset form without a render loop and retains the link's token", async () => {
  window.history.replaceState({}, "", "/reset-password?token=fixture-reset-token");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let commits = 0;
  const screen = () =>
    createElement(
      RecoveryBoundary,
      {},
      createElement(
        Profiler,
        {
          id: "recovery",
          onRender: () => {
            if (++commits > 12) throw new Error("Recovery did not settle");
          },
        },
        createElement(PasswordResetForm),
      ),
    );
  try {
    await act(() => root.render(screen()));
    expect(container.textContent).toContain("Choose a new password");
    expect(container.querySelector<HTMLInputElement>('input[name="token"]')?.value).toBe(
      "fixture-reset-token",
    );
    await act(() => root.render(screen()));
    expect(container.textContent).toContain("Choose a new password");
    expect(commits).toBeLessThan(12);
  } finally {
    await act(() => root.unmount());
    container.remove();
    window.history.replaceState({}, "", "/reset-password");
  }
});
