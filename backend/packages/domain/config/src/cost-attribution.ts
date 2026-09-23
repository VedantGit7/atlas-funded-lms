/**
 * Per-tenant cost attribution (DoD item 8): the pure part.
 *
 * Turns measured usage per tenant, a rate card, and the platform's fixed monthly
 * bills into what each tenant cost to serve in a month. No database access, so
 * the arithmetic that pricing decisions rest on is testable on its own.
 *
 * Two kinds of cost, deliberately kept apart:
 *
 * - Variable: a supplier charges per unit (per GB stored, per email sent), so a
 *   tenant's share is exactly its own usage times the unit rate.
 * - Fixed: a flat monthly bill (a server, a database plan). Nothing about it is
 *   "caused" by one tenant, so it is divided in proportion to whichever usage
 *   actually consumes it -- a server by API requests, an auth plan by members.
 *   The allocation key is chosen per bill, because no single key is right for
 *   all of them.
 *
 * Amounts are USD, as the suppliers bill. They are attribution, not invoicing:
 * floating point is fine here and would not be for a figure charged to anyone.
 */

import type { AllocationKey, CostDriverKey } from "./cost-attribution.catalog";
export { ALLOCATION_KEYS, COST_DRIVER_KEYS } from "./cost-attribution.catalog";
export type { AllocationKey, CostDriverKey } from "./cost-attribution.catalog";

/** What was measured for one tenant in one month. */
export type TenantUsage = {
  /** Distinct members active at least once in the month. */
  activeMembers: number;
  /** Sum over days of members active that day -- a finer load measure than MAU. */
  memberDays: number;
  /** Tenant API requests handled. */
  apiRequests: number;
  /** Wall-clock server time spent on those requests, in milliseconds. */
  apiServerMs: number;
  /** Stored file bytes at the end of the month (or now, for the current month), in GB. */
  storageGb: number;
  /** Emails successfully handed to the email provider on the tenant's behalf. */
  emailsSent: number;
  /** Verified custom domains in service at the end of the month. */
  customDomains: number;
};

export type CostDriverDefinition = {
  key: CostDriverKey;
  label: string;
  /** The unit the rate is quoted in. */
  unit: string;
  /** How many rate units a tenant's usage amounts to. */
  quantity: (usage: TenantUsage) => number;
  /**
   * A starting rate from published supplier pricing, offered in the rate editor
   * so the card is not blank on day one. Never applied automatically: a cost the
   * operator has not confirmed is not a cost the report should present as fact.
   * These are marginal prices -- what one more unit costs once any free
   * allowance is used up -- because that is the number a price must cover.
   */
  suggestion: { unitCostUsd: number; source: string } | null;
};

export const COST_DRIVERS: readonly CostDriverDefinition[] = [
  {
    key: "storage_gb_month",
    label: "File storage",
    unit: "GB-month",
    quantity: (usage) => usage.storageGb,
    suggestion: {
      unitCostUsd: 0.015,
      source: "Cloudflare R2 standard storage, $0.015 per GB-month, no egress fees.",
    },
  },
  {
    key: "active_member",
    label: "Active members",
    unit: "active member",
    quantity: (usage) => usage.activeMembers,
    suggestion: {
      unitCostUsd: 0.00325,
      source: "Supabase Pro, $0.00325 per monthly active user beyond the 100,000 included.",
    },
  },
  {
    key: "email_sent",
    label: "Emails",
    unit: "email",
    quantity: (usage) => usage.emailsSent,
    suggestion: {
      unitCostUsd: 0.0001,
      source: "Amazon SES, $0.10 per 1,000 emails.",
    },
  },
  {
    key: "custom_domain",
    label: "Custom domains",
    unit: "domain-month",
    quantity: (usage) => usage.customDomains,
    suggestion: {
      unitCostUsd: 0.1,
      source: "Cloudflare for SaaS, $0.10 per custom hostname per month beyond the 100 included.",
    },
  },
  {
    key: "api_million_requests",
    label: "API requests",
    unit: "million requests",
    quantity: (usage) => usage.apiRequests / 1_000_000,
    // No suggestion on purpose. On a fixed-price server a request costs nothing
    // extra, and the server belongs in fixed costs allocated by API requests;
    // only a per-request host (serverless) has a real per-unit price here.
    suggestion: null,
  },
];

export const ALLOCATION_KEY_LABELS: Record<AllocationKey, string> = {
  api_requests: "API requests",
  active_members: "Active members",
  member_days: "Member-days",
  storage_gb: "Stored GB",
  equal: "Equal split",
};

function allocationWeight(key: AllocationKey, usage: TenantUsage): number {
  switch (key) {
    case "api_requests":
      return usage.apiRequests;
    case "active_members":
      return usage.activeMembers;
    case "member_days":
      return usage.memberDays;
    case "storage_gb":
      return usage.storageGb;
    case "equal":
      return 1;
  }
}

export type AttributionTenant = {
  tenantId: string;
  slug: string;
  displayName: string;
  state: string;
  usage: TenantUsage;
};

export type AttributionRate = { unitCostUsd: number; effectiveFrom: string };

export type AttributionFixedCost = {
  id: string;
  label: string;
  monthlyCostUsd: number;
  allocationKey: AllocationKey;
};

export type AttributionInput = {
  tenants: readonly AttributionTenant[];
  rates: ReadonlyMap<CostDriverKey, AttributionRate>;
  fixedCosts: readonly AttributionFixedCost[];
};

export type TenantAttribution = {
  tenantId: string;
  slug: string;
  displayName: string;
  state: string;
  usage: TenantUsage;
  /** Per driver; null where no rate is set, so "unpriced" never reads as "free". */
  variableCosts: Record<CostDriverKey, number | null>;
  variableCostUsd: number;
  fixedCostUsd: number;
  totalCostUsd: number;
  /** Null when the tenant had no active members: the ratio is undefined, not zero. */
  costPerActiveMemberUsd: number | null;
  /** This tenant's fraction of all attributed cost, 0..1. */
  shareOfTotal: number;
};

export type FixedCostAllocation = AttributionFixedCost & {
  /**
   * True when no tenant had any of this line's allocation key (e.g. an
   * API-request key in a month with no metered requests), so it was split
   * equally instead. Surfaced rather than silent, because it means the key did
   * not describe that month.
   */
  fellBackToEqualSplit: boolean;
  /** False only when there were no tenants at all to charge. */
  allocated: boolean;
};

export type DriverSummary = {
  key: CostDriverKey;
  label: string;
  unit: string;
  rate: AttributionRate | null;
  totalQuantity: number;
  totalCostUsd: number | null;
};

export type AttributionResult = {
  tenants: TenantAttribution[];
  drivers: DriverSummary[];
  fixedCosts: FixedCostAllocation[];
  totals: {
    variableCostUsd: number;
    fixedCostUsd: number;
    /** Fixed cost that could not be charged to any tenant (no tenants existed). */
    unallocatedFixedCostUsd: number;
    totalCostUsd: number;
    activeMembers: number;
    costPerActiveMemberUsd: number | null;
  };
  /** Drivers with measured usage but no rate: the report is incomplete by exactly these. */
  unpricedDrivers: CostDriverKey[];
};

function emptyVariableCosts(): Record<CostDriverKey, number | null> {
  return {
    storage_gb_month: null,
    active_member: null,
    email_sent: null,
    custom_domain: null,
    api_million_requests: null,
  };
}

export function attributeCosts(input: AttributionInput): AttributionResult {
  const rows = input.tenants.map((tenant) => {
    const variableCosts = emptyVariableCosts();
    let variableCostUsd = 0;
    for (const driver of COST_DRIVERS) {
      const rate = input.rates.get(driver.key);
      if (!rate) continue;
      const cost = driver.quantity(tenant.usage) * rate.unitCostUsd;
      variableCosts[driver.key] = cost;
      variableCostUsd += cost;
    }
    return { tenant, variableCosts, variableCostUsd, fixedCostUsd: 0 };
  });

  const fixedCosts: FixedCostAllocation[] = [];
  let unallocatedFixedCostUsd = 0;

  for (const line of input.fixedCosts) {
    if (rows.length === 0) {
      unallocatedFixedCostUsd += line.monthlyCostUsd;
      fixedCosts.push({ ...line, fellBackToEqualSplit: false, allocated: false });
      continue;
    }

    const weights = rows.map((row) => allocationWeight(line.allocationKey, row.tenant.usage));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const fellBackToEqualSplit = totalWeight <= 0;

    rows.forEach((row, index) => {
      const share = fellBackToEqualSplit ? 1 / rows.length : (weights[index] ?? 0) / totalWeight;
      row.fixedCostUsd += line.monthlyCostUsd * share;
    });

    fixedCosts.push({ ...line, fellBackToEqualSplit, allocated: true });
  }

  const variableTotal = rows.reduce((sum, row) => sum + row.variableCostUsd, 0);
  const fixedTotal = input.fixedCosts.reduce((sum, line) => sum + line.monthlyCostUsd, 0);
  const attributedTotal = rows.reduce(
    (sum, row) => sum + row.variableCostUsd + row.fixedCostUsd,
    0,
  );
  const activeMembers = rows.reduce((sum, row) => sum + row.tenant.usage.activeMembers, 0);

  const tenants: TenantAttribution[] = rows
    .map((row) => {
      const totalCostUsd = row.variableCostUsd + row.fixedCostUsd;
      return {
        tenantId: row.tenant.tenantId,
        slug: row.tenant.slug,
        displayName: row.tenant.displayName,
        state: row.tenant.state,
        usage: row.tenant.usage,
        variableCosts: row.variableCosts,
        variableCostUsd: row.variableCostUsd,
        fixedCostUsd: row.fixedCostUsd,
        totalCostUsd,
        costPerActiveMemberUsd:
          row.tenant.usage.activeMembers > 0 ? totalCostUsd / row.tenant.usage.activeMembers : null,
        shareOfTotal: attributedTotal > 0 ? totalCostUsd / attributedTotal : 0,
      };
    })
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd || a.displayName.localeCompare(b.displayName));

  const drivers: DriverSummary[] = COST_DRIVERS.map((driver) => {
    const rate = input.rates.get(driver.key) ?? null;
    const totalQuantity = rows.reduce((sum, row) => sum + driver.quantity(row.tenant.usage), 0);
    return {
      key: driver.key,
      label: driver.label,
      unit: driver.unit,
      rate,
      totalQuantity,
      totalCostUsd: rate ? totalQuantity * rate.unitCostUsd : null,
    };
  });

  const unpricedDrivers = drivers
    .filter((driver) => driver.rate === null && driver.totalQuantity > 0)
    .map((driver) => driver.key);

  const totalCostUsd = variableTotal + fixedTotal;

  return {
    tenants,
    drivers,
    fixedCosts,
    totals: {
      variableCostUsd: variableTotal,
      fixedCostUsd: fixedTotal,
      unallocatedFixedCostUsd,
      totalCostUsd,
      activeMembers,
      costPerActiveMemberUsd: activeMembers > 0 ? totalCostUsd / activeMembers : null,
    },
    unpricedDrivers,
  };
}

/** "2026-09" -> the UTC month it names, or null if it is not a real month. */
export function parseReportMonth(month: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11 || year < 2000) return null;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export function formatReportMonth(date: Date): string {
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
