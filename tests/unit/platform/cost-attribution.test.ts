import { describe, expect, it } from "vitest";
import {
  attributeCosts,
  COST_DRIVERS,
  COST_DRIVER_KEYS,
  formatReportMonth,
  parseReportMonth,
  type AttributionRate,
  type AttributionTenant,
  type CostDriverKey,
  type TenantUsage,
} from "@atlas/domain-config/cost-attribution";

/**
 * The arithmetic pricing decisions rest on (DoD item 8). The SQL that feeds it
 * is proven against a real database in tests/db/cost-attribution.test.ts.
 */

function usage(overrides: Partial<TenantUsage> = {}): TenantUsage {
  return {
    activeMembers: 0,
    memberDays: 0,
    apiRequests: 0,
    apiServerMs: 0,
    storageGb: 0,
    emailsSent: 0,
    customDomains: 0,
    ...overrides,
  };
}

function tenant(id: string, overrides: Partial<TenantUsage> = {}): AttributionTenant {
  return { tenantId: id, slug: id, displayName: id, state: "ACTIVE", usage: usage(overrides) };
}

function rates(entries: Partial<Record<CostDriverKey, number>>) {
  return new Map<CostDriverKey, AttributionRate>(
    Object.entries(entries).map(([key, unitCostUsd]) => [
      key as CostDriverKey,
      { unitCostUsd, effectiveFrom: "2026-09" },
    ]),
  );
}

describe("variable costs", () => {
  it("charges each tenant exactly its own usage at the unit rate", () => {
    const result = attributeCosts({
      tenants: [
        tenant("a", { storageGb: 10, emailsSent: 5000, customDomains: 2 }),
        tenant("b", { storageGb: 1 }),
      ],
      rates: rates({ storage_gb_month: 0.015, email_sent: 0.0001, custom_domain: 0.1 }),
      fixedCosts: [],
    });
    const a = result.tenants.find((t) => t.tenantId === "a");
    const b = result.tenants.find((t) => t.tenantId === "b");
    // 10 * 0.015 + 5000 * 0.0001 + 2 * 0.1 = 0.15 + 0.5 + 0.2
    expect(a?.variableCostUsd).toBeCloseTo(0.85, 10);
    expect(b?.variableCostUsd).toBeCloseTo(0.015, 10);
    expect(a?.variableCosts.email_sent).toBeCloseTo(0.5, 10);
  });

  it("prices API requests per million", () => {
    const result = attributeCosts({
      tenants: [tenant("a", { apiRequests: 2_500_000 })],
      rates: rates({ api_million_requests: 0.4 }),
      fixedCosts: [],
    });
    expect(result.tenants[0]?.variableCostUsd).toBeCloseTo(1, 10);
  });

  it("reports an unpriced driver as null and names it, never as free", () => {
    const result = attributeCosts({
      tenants: [tenant("a", { storageGb: 5, emailsSent: 10 })],
      rates: rates({ storage_gb_month: 0.015 }),
      fixedCosts: [],
    });
    expect(result.tenants[0]?.variableCosts.email_sent).toBeNull();
    expect(result.unpricedDrivers).toEqual(["email_sent"]);
    // A driver nobody used is not "unpriced" in any way that matters.
    expect(result.unpricedDrivers).not.toContain("custom_domain");
  });
});

describe("fixed cost allocation", () => {
  it("divides a line in proportion to its allocation key", () => {
    const result = attributeCosts({
      tenants: [tenant("a", { apiRequests: 750 }), tenant("b", { apiRequests: 250 })],
      rates: rates({}),
      fixedCosts: [
        { id: "srv", label: "Server", monthlyCostUsd: 24, allocationKey: "api_requests" },
      ],
    });
    expect(result.tenants.find((t) => t.tenantId === "a")?.fixedCostUsd).toBeCloseTo(18, 10);
    expect(result.tenants.find((t) => t.tenantId === "b")?.fixedCostUsd).toBeCloseTo(6, 10);
    expect(result.fixedCosts[0]?.fellBackToEqualSplit).toBe(false);
  });

  it("uses a different key per line", () => {
    const result = attributeCosts({
      tenants: [
        tenant("a", { apiRequests: 100, activeMembers: 1 }),
        tenant("b", { apiRequests: 0, activeMembers: 3 }),
      ],
      rates: rates({}),
      fixedCosts: [
        { id: "srv", label: "Server", monthlyCostUsd: 20, allocationKey: "api_requests" },
        { id: "db", label: "Database", monthlyCostUsd: 20, allocationKey: "active_members" },
      ],
    });
    // a: all of the server, a quarter of the database. b: three quarters of it.
    expect(result.tenants.find((t) => t.tenantId === "a")?.fixedCostUsd).toBeCloseTo(25, 10);
    expect(result.tenants.find((t) => t.tenantId === "b")?.fixedCostUsd).toBeCloseTo(15, 10);
  });

  it("falls back to an equal split when nobody had any of the key, and says so", () => {
    const result = attributeCosts({
      tenants: [tenant("a"), tenant("b"), tenant("c"), tenant("d")],
      rates: rates({}),
      fixedCosts: [
        { id: "srv", label: "Server", monthlyCostUsd: 20, allocationKey: "api_requests" },
      ],
    });
    for (const row of result.tenants) expect(row.fixedCostUsd).toBeCloseTo(5, 10);
    expect(result.fixedCosts[0]?.fellBackToEqualSplit).toBe(true);
  });

  it("allocates every fixed dollar -- nothing is lost to rounding or missing keys", () => {
    const result = attributeCosts({
      tenants: [
        tenant("a", { apiRequests: 1, memberDays: 7, storageGb: 0.3 }),
        tenant("b", { apiRequests: 2, memberDays: 0, storageGb: 0.7 }),
        tenant("c", { apiRequests: 0, memberDays: 3, storageGb: 0 }),
      ],
      rates: rates({}),
      fixedCosts: [
        { id: "1", label: "A", monthlyCostUsd: 33.33, allocationKey: "api_requests" },
        { id: "2", label: "B", monthlyCostUsd: 10, allocationKey: "member_days" },
        { id: "3", label: "C", monthlyCostUsd: 7.5, allocationKey: "storage_gb" },
        { id: "4", label: "D", monthlyCostUsd: 9, allocationKey: "equal" },
      ],
    });
    const allocated = result.tenants.reduce((sum, row) => sum + row.fixedCostUsd, 0);
    expect(allocated).toBeCloseTo(59.83, 9);
    expect(result.totals.fixedCostUsd).toBeCloseTo(59.83, 9);
    expect(result.totals.unallocatedFixedCostUsd).toBe(0);
  });

  it("reports a fixed cost as unallocated when there are no tenants to charge", () => {
    const result = attributeCosts({
      tenants: [],
      rates: rates({}),
      fixedCosts: [{ id: "srv", label: "Server", monthlyCostUsd: 24, allocationKey: "equal" }],
    });
    expect(result.totals.unallocatedFixedCostUsd).toBe(24);
    expect(result.fixedCosts[0]?.allocated).toBe(false);
  });
});

describe("per-member and share figures", () => {
  it("leaves cost per active member undefined for a tenant with no active members", () => {
    const result = attributeCosts({
      tenants: [tenant("a", { activeMembers: 4 }), tenant("idle")],
      rates: rates({}),
      fixedCosts: [{ id: "x", label: "X", monthlyCostUsd: 10, allocationKey: "equal" }],
    });
    expect(result.tenants.find((t) => t.tenantId === "a")?.costPerActiveMemberUsd).toBeCloseTo(
      1.25,
      10,
    );
    expect(result.tenants.find((t) => t.tenantId === "idle")?.costPerActiveMemberUsd).toBeNull();
    expect(result.totals.costPerActiveMemberUsd).toBeCloseTo(2.5, 10);
  });

  it("shares sum to one and tenants are ordered most expensive first", () => {
    const result = attributeCosts({
      tenants: [tenant("small", { storageGb: 1 }), tenant("big", { storageGb: 9 })],
      rates: rates({ storage_gb_month: 1 }),
      fixedCosts: [],
    });
    expect(result.tenants.map((t) => t.tenantId)).toEqual(["big", "small"]);
    expect(result.tenants.reduce((sum, t) => sum + t.shareOfTotal, 0)).toBeCloseTo(1, 10);
  });
});

describe("driver catalogue", () => {
  it("defines every driver the database accepts, and only those", () => {
    // The CHECK constraint in migration 106 lists the same keys; a driver added
    // in one place and not the other would fail at insert time in production.
    expect(COST_DRIVERS.map((driver) => driver.key)).toEqual([...COST_DRIVER_KEYS]);
  });

  it("offers suggestions but never a negative or missing source", () => {
    for (const driver of COST_DRIVERS) {
      if (driver.suggestion === null) continue;
      expect(driver.suggestion.unitCostUsd).toBeGreaterThan(0);
      expect(driver.suggestion.source.length).toBeGreaterThan(10);
    }
  });
});

describe("report months", () => {
  it("parses a month into its UTC bounds", () => {
    expect(parseReportMonth("2026-12")).toEqual({
      start: new Date("2026-12-01T00:00:00.000Z"),
      end: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(formatReportMonth(new Date("2026-02-28T23:59:59Z"))).toBe("2026-02");
  });

  it("rejects things that are not months", () => {
    for (const bad of ["2026-13", "2026-00", "26-01", "2026-1", "", "1999-01"]) {
      expect(parseReportMonth(bad)).toBeNull();
    }
  });
});
