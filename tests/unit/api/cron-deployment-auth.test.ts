import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("scheduled job failures and credentials (audit M5)", () => {
  function authorized(path: string) {
    return new NextRequest(`https://api.example.test/api/v1/internal/${path}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
    });
  }

  it.each([
    ["fx/refresh", fx, services.fx, "FX_REFRESH_FAILED"],
    ["certificates/expire", certificates, services.certificates, "CERTIFICATE_EXPIRY_FAILED"],
    ["reports/tick", reports, services.reports, "REPORT_TICK_FAILED"],
  ] as const)(
    "%s answers a failure with a code and request id, never the detail",
    async (path, handler, service, code) => {
      service.mockRejectedValue(
        new Error(
          'relation "tenants" does not exist at db.internal.example:5432 (password=hunter2)',
        ),
      );
      const response = await handler(authorized(path));
      const body = (await response.json()) as { error: { code: string; requestId: string } };
      expect(response.status).toBe(502);
      expect(body.error.code).toBe(code);
      expect(body.error.requestId).toMatch(/^cron:/);
      expect(JSON.stringify(body)).not.toMatch(/tenants|db\.internal|hunter2/);
    },
  );

  it("compares the credential in constant time, including for a different length", async () => {
    const { cronCredentialMatches } =
      await import("../../../backend/apps/api/src/server/internal/cron-auth");
    const secret = "synthetic-cron-credential-not-a-live-secret";
    expect(cronCredentialMatches(`Bearer ${secret}`, secret)).toBe(true);
    for (const header of [null, "", `Bearer ${secret}x`, `Bearer ${secret.slice(0, -1)}`, secret])
      expect(cronCredentialMatches(header, secret)).toBe(false);

    const source = readFileSync(
      resolve(import.meta.dirname, "../../../backend/apps/api/src/server/internal/cron-auth.ts"),
      "utf8",
    );
    expect(source).toContain("timingSafeEqual");
    for (const route of ["fx/refresh", "certificates/expire", "reports/tick"]) {
      const routeSource = readFileSync(
        resolve(
          import.meta.dirname,
          `../../../backend/apps/api/src/app/api/v1/internal/${route}/route.ts`,
        ),
        "utf8",
      );
      expect(routeSource).toContain("createCronHandler");
      expect(routeSource).not.toContain("!== `Bearer");
      expect(routeSource).not.toContain("String(error)");
    }
  });

  it("removes the duplicate report tick and leaves scheduling to the worker", () => {
    const root = resolve(import.meta.dirname, "../../..");
    expect(existsSync(resolve(root, "backend/apps/api/src/app/api/v1/reports/internal"))).toBe(
      false,
    );
    const vercel = JSON.parse(
      readFileSync(resolve(root, "frontend/apps/web/vercel.json"), "utf8"),
    ) as {
      crons?: unknown[];
    };
    expect(vercel.crons ?? []).toEqual([]);
  });
});
