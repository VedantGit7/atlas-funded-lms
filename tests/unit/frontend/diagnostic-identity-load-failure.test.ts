// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const pending = vi.hoisted(() => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release() };
});
vi.mock(
  "../../../frontend/apps/web/src/features/diagnostics/components/DiagnosticIdentityGate",
  async () => {
    await pending.promise;
    throw new Error("ChunkLoadError: offline");
  },
);
import { DeferredDiagnosticIdentityGate } from "../../../frontend/apps/web/src/features/diagnostics/components/DeferredDiagnosticIdentityGate";

function CompletedDiagnostic() {
  const [open, setOpen] = useState(false);
  const [result] = useState("Completed diagnostic: 82");
  return createElement(
    "main",
    null,
    createElement("p", null, result),
    createElement("button", { onClick: () => setOpen(true) }, "Save my results"),
    createElement(DeferredDiagnosticIdentityGate, {
      anonymousId: "anonymous-session",
      open,
      onClose: () => setOpen(false),
    }),
  );
}
const container = document.createElement("div");
document.body.append(container);
const uncaught: unknown[] = [];
const root = createRoot(container, {
  onUncaughtError: (error) => {
    uncaught.push(error);
  },
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => {
  await act(() => root.unmount());
  vi.restoreAllMocks();
});

function button(text: string) {
  const found = [...container.querySelectorAll("button")].find((node) => node.textContent === text);
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

it("retains the completed diagnostic when the dialog chunk fails and retries locally", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await act(() => root.render(createElement(CompletedDiagnostic)));
  await act(() => button("Save my results").click());
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading sign-in");
  expect(button("Close")).toBeDefined();
  await act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(container.querySelector('[role="status"]')).toBeNull();
  await act(async () => {
    pending.release();
    await vi.dynamicImportSettled();
  });
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("Completed diagnostic: 82");
  await act(async () => {
    button("Save my results").click();
    await vi.dynamicImportSettled();
  });
  expect(container.textContent).toContain("Completed diagnostic: 82");
  expect(uncaught).toEqual([]);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to load");
  await act(() => button("Close").click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => {
    button("Save my results").click();
    await vi.dynamicImportSettled();
  });
  vi.doMock(
    "../../../frontend/apps/web/src/features/diagnostics/components/DiagnosticIdentityGate",
    () => ({
      DiagnosticIdentityGate: ({ anonymousId }: { anonymousId: string }) =>
        createElement("p", null, `Sign-in form for ${anonymousId}`),
    }),
  );
  await act(async () => {
    button("Retry").click();
    await vi.dynamicImportSettled();
  });
  expect(container.textContent).toContain("Sign-in form for anonymous-session");
  expect(container.textContent).toContain("Completed diagnostic: 82");
  expect(uncaught).toEqual([]);
});
