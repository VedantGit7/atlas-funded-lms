// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const mocks = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock(
  "../../../frontend/apps/web/src/app/(auth)/reset-password/_actions/reset-password-action",
  () => ({
    completePasswordResetAction: mocks.complete,
    requestPasswordResetAction: vi.fn(),
  }),
);
import { PasswordResetForm } from "../../../frontend/apps/web/src/app/(auth)/reset-password/_components/PasswordResetForm";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("asks for the authenticator code when the reset answers that the account has MFA", async () => {
  mocks.complete.mockResolvedValue({
    ok: false,
    mfaRequired: true,
    message: "Your account uses two-step verification.",
    requestId: "r1",
  });
  window.history.replaceState(
    {},
    "",
    "/reset-password#type=recovery&access_token=fixture-access&refresh_token=fixture-refresh",
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() => root.render(createElement(PasswordResetForm)));
    expect(container.textContent).not.toContain("Authenticator code");

    const password = container.querySelector<HTMLInputElement>('input[name="password"]');
    if (!password) throw new Error("password field missing");
    await act(async () => {
      typeInto(password, "a-new-strong-password");
    });
    await act(async () => {
      container.querySelector("form")?.requestSubmit();
    });
    // Validation loads the schema lazily, so the submit settles on its own time.
    await vi.waitFor(
      async () => {
        await act(async () => {});
        expect(mocks.complete).toHaveBeenCalledTimes(1);
        expect(container.textContent).toContain("Authenticator code");
      },
      { timeout: 5_000 },
    );

    const sent = mocks.complete.mock.calls[0]?.[1] as FormData;
    expect(sent.get("password")).toBe("a-new-strong-password");
    expect(sent.get("accessToken")).toBe("fixture-access");
    expect(container.textContent).toContain("Authenticator code");
    expect(container.textContent).toContain("Your account uses two-step verification.");
    expect(
      container.querySelector('[aria-label="Authenticator verification code"]'),
    ).not.toBeNull();
    // The password typed so far is kept for the second submit.
    expect(container.querySelector<HTMLInputElement>('input[name="password"]')?.value).toBe(
      "a-new-strong-password",
    );
  } finally {
    await act(() => root.unmount());
    container.remove();
    window.history.replaceState({}, "", "/reset-password");
  }
});
