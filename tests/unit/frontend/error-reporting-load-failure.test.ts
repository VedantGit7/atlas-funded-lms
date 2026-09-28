import { expect, it, vi } from "vitest";

vi.mock("../../../frontend/apps/web/node_modules/@sentry/nextjs", () => {
  throw new Error("Reporting chunk unavailable");
});

it("settles with a local diagnostic when the reporting chunk fails to load", async () => {
  const { reportClientError } =
    await import("../../../frontend/apps/web/src/observability/report-client-error");
  const error = new Error("Original page error");
  const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(reportClientError(error)).resolves.toBeUndefined();
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith("Unable to send the error report.", error);
  } finally {
    diagnostic.mockRestore();
  }
});
