import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  certificates: vi.fn(),
  reports: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("../../../backend/apps/api/src/server/certificates/certificate-worker-router", () => ({
  processCertificateOutboxBatch: mocks.certificates,
}));
vi.mock("../../../backend/apps/api/src/server/reports/reports-worker-router", () => ({
  processReportsOutboxBatch: mocks.reports,
}));
vi.mock("@atlas/domain/reports/reports.worker", () => ({
  processReportGenerateStandalone: mocks.generate,
}));
import { scheduleCertificatePdfDrain } from "../../../backend/apps/api/src/server/certificates/certificate-pdf-drain";
import { scheduleReportExportProcessing } from "../../../backend/apps/api/src/server/reports/report-exports-async";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("deployed artifact worker ownership", () => {
  it("leaves queued PDFs and exports to the worker without scheduling request callbacks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CERTIFICATE_PDF_WORKER", "true");
    const args = {
      tenantId: "tenant",
      requestId: "request",
      actorMembershipId: "member",
      reportRunId: "run",
      format: "csv" as const,
      requestedAt: new Date().toISOString(),
    };
    scheduleCertificatePdfDrain(args);
    scheduleReportExportProcessing("payments", args);
    scheduleReportExportProcessing("sales-marketing", args);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.certificates).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.reports).not.toHaveBeenCalled();
  });
  it("generates a local export for the report it was scheduled for, then drains delivery", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("RELEASE_ENV", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    mocks.generate.mockResolvedValue(undefined);
    mocks.reports.mockResolvedValue(undefined);
    scheduleReportExportProcessing("sales-marketing", {
      tenantId: "tenant",
      requestId: "request",
      actorMembershipId: "11111111-1111-4111-8111-111111111111",
      reportRunId: "22222222-2222-4222-8222-222222222222",
      format: "xlsx",
      requestedAt: "2026-10-10T10:00:00.000Z",
    });
    const callback = mocks.after.mock.calls[0]?.[0] as () => Promise<unknown>;
    await callback();
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant",
        event: expect.objectContaining({
          id: "22222222-2222-4222-8222-222222222222",
          payload: expect.objectContaining({
            reportDefinitionKey: "sales-marketing",
            format: "xlsx",
          }) as unknown,
        }) as unknown,
      }),
    );
    expect(mocks.reports).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant", requestId: "request:delivery", limit: 10 }),
    );
  });
  it("returns the local PDF drain promise to Next after", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("RELEASE_ENV", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("CERTIFICATE_PDF_WORKER", "true");
    mocks.certificates.mockResolvedValue({ processed: 1 });
    scheduleCertificatePdfDrain({ tenantId: "tenant", requestId: "request" });
    const callback = mocks.after.mock.calls[0]?.[0] as () => Promise<unknown>;
    expect(callback()).toBeInstanceOf(Promise);
    await Promise.resolve();
  });
});
