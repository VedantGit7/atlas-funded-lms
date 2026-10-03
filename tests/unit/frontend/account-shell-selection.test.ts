import { expect, it, vi } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";

const state = vi.hoisted(() => ({ kind: "learner", loads: [] as string[] }));
vi.mock("../../../frontend/apps/web/src/lib/server/account-role", () => ({
  resolveAccountShellKind: () => state.kind,
}));
vi.mock("../../../frontend/apps/web/src/features/account-settings/account-theme-context", () => ({
  AccountThemeProvider: "theme-provider",
}));
vi.mock("../../../frontend/apps/web/src/components/shells/AdminAccountShell", () => {
  state.loads.push("admin");
  return { AdminAccountShell: "admin-shell" };
});
vi.mock("../../../frontend/apps/web/src/components/shells/LearnerShell", () => {
  state.loads.push("learner");
  return { LearnerShell: "learner-shell" };
});
vi.mock("../../../frontend/apps/web/src/components/shells/StudioShell", () => {
  state.loads.push("instructor");
  return { StudioShell: "studio-shell" };
});
vi.mock("../../../frontend/apps/web/src/components/shells/ModerationShell", () => {
  state.loads.push("moderator");
  return { ModerationShell: "moderation-shell" };
});

it("loads only the authorized role shell and preserves its account theme", async () => {
  const { AccountShell } =
    await import("../../../frontend/apps/web/src/components/shells/AccountShell");
  expect(state.loads).toEqual([]);
  const child = createElement("p", null, "Account settings");
  const expected = [
    ["learner", "learner-shell", "default"],
    ["admin", "admin-shell", "admin"],
    ["instructor", "studio-shell", "studio"],
    ["moderator", "moderation-shell", "default"],
  ] as const;
  for (const [kind, shell, theme] of expected) {
    state.kind = kind;
    const rendered = await AccountShell({ children: child });
    expect(rendered?.type).toBe(shell);
    expect(rendered?.props.children.props.kind).toBe(theme);
    expect(rendered?.props.children.props.children).toBe(child);
    expect(state.loads.at(-1)).toBe(kind);
  }
  expect(state.loads).toEqual(expected.map(([kind]) => kind));
});
