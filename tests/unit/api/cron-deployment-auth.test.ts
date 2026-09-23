import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const services = vi.hoisted(() => ({ fx: vi.fn(), certificates: vi.fn(), reports: vi.fn() }));
vi.mock("@atlas/domain-config/services/fx.service", () => ({
  refreshFxRatesForActiveTenants: services.fx,
}));
vi.mock("../../../backend/apps/api/src/server/certificates/certificate-expiry.service", () => ({
  expireDueCertificatesForActiveTenants: services.certificates,
}));
vi.mock("../../../backend/apps/api/src/server/reports/reports-tick.service", () => ({
  createReportsTickRequestId: () => "cron-test-request",
  tickReportSchedulesForActiveTenants: services.reports,
}));
import { GET as fx } from "../../../backend/apps/api/src/app/api/v1/internal/fx/refresh/route";
import { GET as certificates } from "../../../backend/apps/api/src/app/api/v1/internal/certificates/expire/route";
import { GET as reports } from "../../../backend/apps/api/src/app/api/v1/internal/reports/tick/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "synthetic-cron-credential-not-a-live-secret");
  for (const service of Object.values(services)) service.mockResolvedValue({ processed: 0 });
});
afterEach(() => vi.unstubAllEnvs());
describe.each([
  ["fx/refresh", fx, services.fx],
  ["certificates/expire", certificates, services.certificates],
  ["reports/tick", reports, services.reports],
] as const)("scheduled API job %s", (path, handler, service) => {
  function request(authorization?: string) {
    return new NextRequest(`https://api.example.test/api/v1/internal/${path}`, {
      headers: authorization ? { authorization } : {},
    });
  }
  it("rejects unconfigured scheduling before invoking work", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await handler(request())).status).toBe(503);
    expect(service).not.toHaveBeenCalled();
  });
  it.each([undefined, "Bearer wrong-secret"])(
    "rejects missing or invalid bearer auth: %s",
    async (authorization) => {
      expect((await handler(request(authorization))).status).toBe(401);
      expect(service).not.toHaveBeenCalled();
    },
  );
  it("accepts scheduler GET with the configured bearer credential", async () => {
    const response = await handler(request(`Bearer ${process.env.CRON_SECRET}`));
    expect(response.status).toBe(200);
    expect(service).toHaveBeenCalledOnce();
    expect(service).toHaveBeenCalledWith(expect.any(String));
  });
});
