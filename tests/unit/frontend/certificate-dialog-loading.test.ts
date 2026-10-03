// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import type { ShareCertificate } from "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog";

const pending = vi.hoisted(() => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release(), loads: 0 };
});
vi.mock(
  "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog",
  async () => {
    pending.loads += 1;
    await pending.promise;
    return {
      CertificateShareDialog: ({
        share,
        onClose,
      }: {
        share: ShareCertificate | null;
        onClose: () => void;
      }) =>
        share
          ? createElement(
              "div",
              { role: "dialog" },
              share.title,
              createElement("button", { onClick: onClose }, "Close loaded dialog"),
            )
          : null,
    };
  },
);
import { DeferredCertificateShareDialog } from "../../../frontend/apps/web/src/features/certificates/components/DeferredCertificateShareDialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function Harness() {
  const [open, setOpen] = useState(false);
  return createElement(
    "main",
    null,
    createElement("p", null, "Your earned certificate"),
    createElement("button", { onClick: () => setOpen(true) }, "Share"),
    createElement(DeferredCertificateShareDialog, {
      share: open
        ? {
            url: "https://example.test/verify/one",
            title: "Risk Foundations",
            recipient: "Ada",
            issuerName: "Academy",
          }
        : null,
      onClose: () => setOpen(false),
    }),
  );
}

it("loads on demand, supports pending Escape/focus restoration and ignores completion after close", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() => root.render(createElement(Harness)));
    const trigger = container.querySelector("button");
    expect(pending.loads).toBe(0);
    trigger?.focus();
    await act(() => trigger?.click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading sharing");
    expect(document.activeElement?.textContent).toBe("Close");
    expect(document.body.style.overflow).toBe("hidden");
    await act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    await act(async () => {
      pending.release();
      await vi.dynamicImportSettled();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("Your earned certificate");
    await act(async () => {
      trigger?.click();
      await vi.dynamicImportSettled();
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Risk Foundations");
    expect(pending.loads).toBe(1);
    await act(() => container.querySelector<HTMLButtonElement>('[role="dialog"] button')?.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
