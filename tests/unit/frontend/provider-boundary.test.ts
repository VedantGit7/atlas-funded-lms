import { expect, it, vi } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
const state = vi.hoisted(() => ({ queryLoads: 0 }));
vi.mock("../../../frontend/apps/web/src/components/providers/QueryProvider", () => {
  state.queryLoads += 1;
  return { QueryProvider: "query-provider" };
});
vi.mock("../../../frontend/apps/web/src/components/providers/ThemeProvider", () => ({
  ThemeProvider: "theme-provider",
}));
vi.mock("../../../frontend/apps/web/src/features/currency/CurrencyProvider", () => ({
  CurrencyProvider: "currency-provider",
}));
vi.mock("../../../frontend/apps/web/src/components/feedback/AppToastViewport", () => ({
  AppToastViewport: "toast-viewport",
}));

it("provides learner theme, currency and feedback without loading operational query caching", async () => {
  const { AppProviders } =
    await import("../../../frontend/apps/web/src/components/providers/AppProviders");
  const children = createElement("p", null, "Learner content");
  const rendered = AppProviders({
    children,
    initialDisplayCurrency: "INR",
    initialFxRates: { USD: 1, INR: 86 },
  });
  expect(state.queryLoads).toBe(0);
  // The academy's date and money format wraps everything (S2.4).
  expect(rendered.props.value).toMatchObject({ timeZone: "UTC", currency: "INR" });
  const theme = rendered.props.children;
  expect(theme.type).toBe("theme-provider");
  expect(theme.props.children.type).toBe("currency-provider");
  expect(theme.props.children.props.initialDisplayCurrency).toBe("INR");
  expect(theme.props.children.props.children[0]).toBe(children);
  expect(theme.props.children.props.children[1].type).toBe("toast-viewport");
});
