// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import { useLazyZodForm } from "../../../frontend/apps/web/src/lib/forms/use-lazy-zod-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("shows validation pending and prevents duplicate actions during a cold schema load", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loadSchema = async () => {
    await pending;
    return (
      await import("../../../frontend/packages/contracts/src/domain-identity/schemas/public-auth")
    ).PublicLoginRequestSchema;
  };
  const valid = vi.fn();
  function Login() {
    const form = useLazyZodForm({
      schema: loadSchema,
      errorField: "email",
      defaultValues: { email: "learner@example.test", password: "secret-test" },
    });
    return createElement(
      "form",
      { onSubmit: form.handleSubmit(valid) },
      createElement("input", { ...form.register("email") }),
      createElement(
        "button",
        { type: "submit", disabled: form.formState.isSubmitting },
        form.formState.isSubmitting ? "Signing in…" : "Sign in",
      ),
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() => root.render(createElement(Login)));
    const formElement = container.querySelector("form");
    const button = container.querySelector("button");
    if (!formElement || !button) throw new Error("Expected the login form and submit button");
    await act(() => {
      formElement.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      formElement.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain("Signing in");
    expect(valid).not.toHaveBeenCalled();
    await act(async () => {
      release();
      await vi.dynamicImportSettled();
    });
    expect(valid).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
