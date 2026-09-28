// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const state = vi.hoisted(() => ({ loads: 0 }));
vi.mock(
  "../../../frontend/apps/web/src/features/diagnostics/components/AnonymousDiagnosticScorecard",
  () => ({
    AnonymousDiagnosticScorecard: () => createElement("p", null, "Scorecard"),
  }),
);
vi.mock(
  "../../../frontend/apps/web/src/features/diagnostics/components/DiagnosticIdentityGate",
  () => {
    state.loads += 1;
    return {
      DiagnosticIdentityGate: ({
        open,
        onClose,
        anonymousId,
      }: {
        open: boolean;
        onClose: () => void;
        anonymousId: string;
      }) =>
        createElement(
          "section",
          { hidden: !open, "data-anonymous-id": anonymousId },
          createElement("input", { "aria-label": "Email" }),
          createElement("button", { onClick: onClose }, "Close dialog"),
        ),
    };
  },
);

import { AnonymousDiagnosticResultView } from "../../../frontend/apps/web/src/features/diagnostics/components/AnonymousDiagnosticResultView";

const container = document.createElement("div");
document.body.append(container);
let root = createRoot(container);
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => {
  await act(() => root.unmount());
  root = createRoot(container);
});

function element<K extends keyof HTMLElementTagNameMap>(scope: ParentNode, tag: K) {
  const found = scope.querySelector(tag);
  if (!found) throw new Error(`Missing expected ${tag}`);
  return found;
}

describe("diagnostic identity form loading", () => {
  it("loads only after Save my results, preserving the form on close and reopen", async () => {
    await act(() =>
      root.render(createElement(AnonymousDiagnosticResultView, { anonymousId: "anon-123" })),
    );
    expect(container.textContent).toContain("Scorecard");
    expect(state.loads).toBe(0);
    const save = element(container, "button");
    await act(async () => {
      save.click();
      await vi.dynamicImportSettled();
    });
    expect(state.loads).toBe(1);
    const form = element(container, "section");
    expect(form.hidden).toBe(false);
    expect(form.dataset["anonymousId"]).toBe("anon-123");
    const email = element(container, "input");
    email.value = "learner@example.test";
    await act(() => element(form, "button").click());
    expect(form.hidden).toBe(true);
    await act(() => save.click());
    expect(form.hidden).toBe(false);
    expect(element(container, "input").value).toBe("learner@example.test");
    expect(state.loads).toBe(1);
  });
});
