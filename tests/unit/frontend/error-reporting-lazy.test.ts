// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot } from "../../../frontend/apps/web/node_modules/react-dom/client";

const sdk = vi.hoisted(() => ({ loads: 0, captureException: vi.fn() }));
vi.mock("../../../frontend/apps/web/node_modules/@sentry/nextjs", () => {
  sdk.loads += 1;
  return { captureException: sdk.captureException };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.restoreAllMocks());

it("loads error reporting only when a fallback mounts, retaining the error and reset control", async () => {
  const { RouteErrorFallback } =
    await import("../../../frontend/apps/web/src/components/patterns/RouteErrorFallback");
  await import("../../../frontend/apps/web/src/app/global-error");
  expect(sdk.loads).toBe(0);
  const container = document.createElement("div");
  const root = createRoot(container);
  const reset = vi.fn();
  const error = Object.assign(new Error("test failure"), {
    digest: "req_12345678-1234-1234-1234-123456789012",
  });
  try {
    await act(() => root.render(createElement(RouteErrorFallback, { error, reset })));
    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain(error.digest);
    await vi.waitFor(() => expect(sdk.captureException).toHaveBeenCalledWith(error));
    expect(sdk.loads).toBe(1);
    await act(() => container.querySelector("button")?.click());
    expect(reset).toHaveBeenCalledOnce();
  } finally {
    await act(() => root.unmount());
  }
});

it("contains reporting failure, keeps a local diagnostic and retries the next report", async () => {
  const { reportClientError } =
    await import("../../../frontend/apps/web/src/observability/report-client-error");
  const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("report me");
  sdk.captureException.mockImplementationOnce(() => {
    throw new Error("SDK unavailable");
  });
  await expect(reportClientError(error)).resolves.toBeUndefined();
  expect(diagnostic).toHaveBeenCalledWith("Unable to send the error report.", error);
  await reportClientError(error);
  expect(sdk.captureException).toHaveBeenLastCalledWith(error);
  expect(diagnostic).toHaveBeenCalledOnce();
});
