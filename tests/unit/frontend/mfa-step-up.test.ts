// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";
import { clientApi } from "../../../frontend/apps/web/src/lib/api/client";
import {
  registerMfaStepUpHandler,
  requestMfaStepUp,
} from "../../../frontend/apps/web/src/lib/api/mfa-step-up";
import { MfaStepUpProvider } from "../../../frontend/apps/web/src/components/security/MfaStepUpProvider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const mfaRequired = () =>
  json(403, {
    error: { code: "MFA_REQUIRED", message: "This action requires multi-factor authentication." },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client step-up (audit H4)", () => {
  it("retries once, with the same idempotency key, after the user steps up", async () => {
    const unregister = registerMfaStepUpHandler(async () => true);
    fetchMock
      .mockResolvedValueOnce(mfaRequired())
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));

    await expect(
      clientApi.post("/api/v1/roles", { name: "Ops" }, "role-create", { silent: true }),
    ).resolves.toEqual({
      data: { ok: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map(([, init]) =>
      new Headers((init as RequestInit).headers).get("idempotency-key"),
    );
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    unregister();
  });

  it("surfaces the error when the user declines, and never loops", async () => {
    const unregister = registerMfaStepUpHandler(async () => false);
    fetchMock.mockImplementation(() => Promise.resolve(mfaRequired()));
    await expect(
      clientApi.post("/api/v1/roles", {}, "role-create", { silent: true }),
    ).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const accepting = registerMfaStepUpHandler(async () => true);
    fetchMock.mockClear();
    await expect(
      clientApi.post("/api/v1/roles", {}, "role-create", { silent: true }),
    ).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    accepting();
    unregister();
  });

  it("fails as before where no step-up dialog is mounted", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(mfaRequired()));
    await expect(clientApi.get("/api/v1/payments/orders/export")).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one prompt between concurrent requests", async () => {
    let release: (value: boolean) => void = () => undefined;
    const handler = vi.fn(() => new Promise<boolean>((resolve) => (release = resolve)));
    const unregister = registerMfaStepUpHandler(handler);
    const first = requestMfaStepUp("a");
    const second = requestMfaStepUp("b");
    release(true);
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });
});

describe("MfaStepUpProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function openDialog(factors: unknown[]) {
    fetchMock.mockResolvedValueOnce(json(200, { data: { factors } }));
    await act(async () => {
      root.render(createElement(MfaStepUpProvider));
      await Promise.resolve();
    });
    let outcome: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      outcome = requestMfaStepUp("This action requires multi-factor authentication.");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Wrapped: an async function returning a promise would be awaited until the dialog closes.
    return { outcome };
  }
  const dialog = () => container.querySelector<HTMLElement>('[role="dialog"]');

  it("verifies a code with an enrolled authenticator, then resolves true", async () => {
    const { outcome } = await openDialog([{ id: "f1", factorType: "totp", status: "verified" }]);
    expect(dialog()?.textContent).toContain("Enter the 6-digit code");
    const input = container.querySelector<HTMLInputElement>("input[name=code]");
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(container.querySelector("label")?.textContent).toBe("Authentication code");

    fetchMock.mockResolvedValueOnce(
      json(400, { error: { code: "VALIDATION_ERROR", message: "That code didn't work." } }),
    );
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "000000");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("That code didn't work.");

    fetchMock.mockResolvedValueOnce(json(200, { data: { ok: true } }));
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "123456");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await expect(outcome).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("/api/v1/me/security/mfa/step-up");
    expect(JSON.parse(String(init.body))).toEqual({ code: "123456" });
    expect(dialog()).toBeNull();
  });

  it("sends a user without an authenticator to set one up and come back", async () => {
    window.history.replaceState(null, "", "/admin/roles?tab=custom");
    const { outcome } = await openDialog([]);
    const setup = container.querySelector<HTMLAnchorElement>("a");
    expect(setup?.textContent).toBe("Set up authenticator");
    expect(setup?.getAttribute("href")).toBe(
      `/profile/security?setup=mfa&next=${encodeURIComponent("/admin/roles?tab=custom")}`,
    );
    expect(container.querySelector("input")).toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button[type=button]:not([aria-label])")?.click();
      await Promise.resolve();
    });
    await expect(outcome).resolves.toBe(false);
  });

  it("closes on Escape and resolves false", async () => {
    const { outcome } = await openDialog([{ id: "f1", factorType: "totp", status: "verified" }]);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await Promise.resolve();
    });
    await expect(outcome).resolves.toBe(false);
    expect(dialog()).toBeNull();
  });
});
