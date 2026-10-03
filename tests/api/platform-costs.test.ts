import { createPlatformIdempotencyStore } from "../helpers/platform-idempotency-tx";
const replayStore = createPlatformIdempotencyStore();
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { PLATFORM_ROLE_PERMISSIONS } from "@atlas/access";

/**
 * Route boundary for per-tenant cost attribution (DoD item 8): which permission
 * each route demands, that the platform reason is required, and that bodies are
 * validated before any service runs. The service and SQL are covered in
 * tests/unit/platform/cost-attribution.test.ts and tests/db/cost-attribution.test.ts.
 */

const {
  mockRequirePlatformPrincipal,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockGetReport,
  mockGetRateCard,
  mockSetRate,
  mockCreateFixed,
  mockEndFixed,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithPlatformScope: vi.fn((_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn(replayStore.wrap({ $queryRaw: vi.fn() })),
  ),
  mockGetReport: vi.fn(),
  mockGetRateCard: vi.fn(),
  mockSetRate: vi.fn(),
  mockCreateFixed: vi.fn(),
  mockEndFixed: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mockRequirePlatformPrincipal(...args),
}));

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, withPlatformScope: mockWithPlatformScope };
});

vi.mock("@atlas/domain-config/services/cost-attribution.service", () => ({
  getCostAttributionReport: (...args: unknown[]) => mockGetReport(...args),
  getCostRateCard: (...args: unknown[]) => mockGetRateCard(...args),
  setCostRate: (...args: unknown[]) => mockSetRate(...args),
  createFixedCost: (...args: unknown[]) => mockCreateFixed(...args),
  endFixedCost: (...args: unknown[]) => mockEndFixed(...args),
}));

import { GET as getReport } from "../../backend/apps/api/src/app/api/v1/platform/costs/route";
import {
  GET as getRates,
  POST as postRate,
} from "../../backend/apps/api/src/app/api/v1/platform/costs/rates/route";
import { POST as postFixed } from "../../backend/apps/api/src/app/api/v1/platform/costs/fixed/route";
import { POST as postEndFixed } from "../../backend/apps/api/src/app/api/v1/platform/costs/fixed/[id]/end/route";

const HOST = "platform.example.com";
const PRINCIPAL = "018f0000-0000-7000-8000-000000000010";
const LINE_ID = "018f0000-0000-7000-8000-000000000020";

function request(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const method = init.method ?? "GET";
  return new NextRequest(`https://${HOST}${path}`, {
    method,
    headers: {
      host: HOST,
      authorization: "Bearer platform-token",
      [ATLAS_PLATFORM_REASON_HEADER]: "Reviewing platform cost attribution",
      ...(method === "GET" ? {} : { origin: `https://${HOST}`, "idempotency-key": "cost-key-1" }),
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const emptyReport = {
  data: {
    month: "2026-09",
    currency: "USD",
    isPartialMonth: true,
    snapshotAt: "2026-09-18T00:00:00.000Z",
    tenants: [],
    drivers: [],
    fixedCosts: [],
    totals: {
      variableCostUsd: 0,
      fixedCostUsd: 0,
      unallocatedFixedCostUsd: 0,
      totalCostUsd: 0,
      activeMembers: 0,
      costPerActiveMemberUsd: null,
    },
    unpricedDrivers: [],
    notMetered: [],
  },
};

const rateRow = {
  data: {
    id: "018f0000-0000-7000-8000-000000000030",
    driver: "storage_gb_month",
    unitCostUsd: 0.015,
    effectiveFrom: "2026-09",
    reason: "R2 invoice, September 2026",
    createdAt: "2026-09-18T00:00:00.000Z",
  },
};

describe("platform cost attribution routes", () => {
  beforeEach(() => {
    for (const mock of [
      mockRequirePlatformPrincipal,
      mockGetReport,
      mockGetRateCard,
      mockSetRate,
      mockCreateFixed,
      mockEndFixed,
    ]) {
      mock.mockReset();
    }
    mockRequirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: PRINCIPAL,
      platformPermissions: ["platform.cost.read", "platform.cost.manage"],
    });
    mockGetReport.mockResolvedValue(emptyReport);
    mockSetRate.mockResolvedValue(rateRow);
  });

  it("reads the report with platform.cost.read and passes the month through", async () => {
    const response = await getReport(request("/api/v1/platform/costs?month=2026-08"));
    expect(response.status).toBe(200);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: "platform.cost.read" }),
    );
    expect(mockGetReport).toHaveBeenCalledWith(expect.anything(), { month: "2026-08" });
  });

  it("rejects a malformed month before the service runs", async () => {
    const response = await getReport(request("/api/v1/platform/costs?month=2026-13"));
    expect(response.status).toBe(400);
    expect(mockGetReport).not.toHaveBeenCalled();
  });

  it("requires the platform reason even to read costs", async () => {
    const response = await getRates(
      request("/api/v1/platform/costs/rates", { headers: { [ATLAS_PLATFORM_REASON_HEADER]: "" } }),
    );
    expect(response.status).toBe(400);
    expect(mockGetRateCard).not.toHaveBeenCalled();
  });

  it("sets a rate with platform.cost.manage", async () => {
    const response = await postRate(
      request("/api/v1/platform/costs/rates", {
        method: "POST",
        body: {
          driver: "storage_gb_month",
          unitCostUsd: "0.015",
          effectiveFrom: "2026-09",
          reason: "R2 invoice, September 2026",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: "platform.cost.manage" }),
    );
    expect(mockSetRate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ platformPrincipalId: PRINCIPAL }),
      expect.objectContaining({ unitCostUsd: "0.015" }),
    );
  });

  it.each([
    ["a JSON number for money", { unitCostUsd: 0.015 }],
    ["a negative rate", { unitCostUsd: "-1" }],
    ["too many decimal places", { unitCostUsd: "0.0000001" }],
    ["an unknown driver", { driver: "bandwidth" }],
    ["an unknown field", { tenantId: "018f0000-0000-7000-8000-000000000001" }],
  ])("rejects %s", async (_label, override) => {
    const response = await postRate(
      request("/api/v1/platform/costs/rates", {
        method: "POST",
        body: {
          driver: "storage_gb_month",
          unitCostUsd: "0.015",
          effectiveFrom: "2026-09",
          reason: "R2 invoice, September 2026",
          ...override,
        },
      }),
    );
    expect(response.status).toBe(400);
    expect(mockSetRate).not.toHaveBeenCalled();
  });

  it("requires an idempotency key on writes", async () => {
    const response = await postFixed(
      request("/api/v1/platform/costs/fixed", {
        method: "POST",
        headers: { "idempotency-key": "" },
        body: {
          label: "Server",
          monthlyCostUsd: "24",
          allocationKey: "api_requests",
          effectiveFrom: "2026-09",
          reason: "Lightsail Mumbai 4 GB plan",
        },
      }),
    );
    expect(response.status).toBe(400);
    expect(mockCreateFixed).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin write", async () => {
    const response = await postEndFixed(
      request(`/api/v1/platform/costs/fixed/${LINE_ID}/end`, {
        method: "POST",
        headers: { origin: "https://attacker.example" },
        body: { effectiveUntil: "2026-09", reason: "Moved to a smaller server" },
      }),
      { params: Promise.resolve({ id: LINE_ID }) },
    );
    expect(response.status).toBe(403);
    expect(mockEndFixed).not.toHaveBeenCalled();
  });

  it("denies a principal without cost permissions", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );
    const response = await getReport(request("/api/v1/platform/costs"));
    expect(response.status).toBe(403);
    expect(mockGetReport).not.toHaveBeenCalled();
  });
});

describe("cost permissions by platform role", () => {
  it("gives super admins and operations read and manage", () => {
    for (const role of ["super_admin", "operations"] as const) {
      expect(PLATFORM_ROLE_PERMISSIONS[role]).toEqual(
        expect.arrayContaining(["platform.cost.read", "platform.cost.manage"]),
      );
    }
  });

  it("gives support no cost access at all", () => {
    expect(PLATFORM_ROLE_PERMISSIONS.support).not.toContain("platform.cost.read");
    expect(PLATFORM_ROLE_PERMISSIONS.support).not.toContain("platform.cost.manage");
  });
});
