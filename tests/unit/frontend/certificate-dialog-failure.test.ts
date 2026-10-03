// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";
import type { ShareCertificate } from "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog";

vi.mock(
  "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog",
  () => {
    throw new Error("Sharing chunk unavailable");
  },
);
import { DeferredCertificateShareDialog } from "../../../frontend/apps/web/src/features/certificates/components/DeferredCertificateShareDialog";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("keeps failures local, traps pending focus and retries without losing certificate details", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        createElement(DeferredCertificateShareDialog, {
          share: {
            url: "https://example.test/verify/one",
            title: "Risk Foundations",
            recipient: "Ada",
            issuerName: "Academy",
          },
          onClose: vi.fn(),
        }),
      );
      await vi.dynamicImportSettled();
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to load sharing options",
    );
    const [retry, close] = container.querySelectorAll("button");
    close?.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    expect(document.activeElement).toBe(retry);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(close);
    vi.doMock(
      "../../../frontend/apps/web/src/features/certificates/components/CertificateShareDialog",
      () => ({
        CertificateShareDialog: ({ share }: { share: ShareCertificate }) =>
          createElement("p", null, `${share.title}: ${share.url}`),
      }),
    );
    await act(async () => {
      retry?.click();
      await vi.dynamicImportSettled();
    });
    expect(container.textContent).toContain("Risk Foundations: https://example.test/verify/one");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
