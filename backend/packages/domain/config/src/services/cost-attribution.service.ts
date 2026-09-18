import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  ALLOCATION_KEYS,
  ALLOCATION_KEY_LABELS,
  attributeCosts,
  COST_DRIVERS,
  formatReportMonth,
  parseReportMonth,
  type AttributionRate,
  type CostDriverKey,
  type TenantUsage,
} from "../cost-attribution";
import {
  endFixedCost as endFixedCostRow,
  findFixedCost,
  insertFixedCost,
  insertRate,
  listFixedCosts,
  listRateHistory,
  listTenantsInMonth,
  readFixedCostsInForce,
  readRatesInForce,
  readUsageByTenant,
  type FixedCostRow,
  type RateRow,
} from "../repositories/cost-attribution.repository";
import type {
  CostRateCardResponse,
  CostReportResponse,
  CreateFixedCostRequest,
  EndFixedCostRequest,
  SetCostRateRequest,
} from "../schemas/cost-attribution";

type PlatformCtx = { platformPrincipalId: string; requestId: string };

/**
 * Supplier costs this report cannot see yet. Returned with every report so the
 * total reads as a floor, not as the whole bill: an attribution that silently
 * omits a cost is worse for pricing than one that names the gap.
 */
const NOT_METERED = [
  {
    key: "video_delivery",
    label: "Video storage and delivery",
    why: "Video is hosted by the video provider, which bills per GB stored and delivered. Neither figure is recorded per tenant here.",
  },
  {
    key: "web_rendering",
    label: "Page rendering",
    why: "Only API requests are metered. Server rendering of pages and public (signed-out) routes is not counted per tenant.",
  },
  {
    key: "database_size",
    label: "Database size",
    why: "Postgres storage is shared and not measured per tenant; include the database plan as a fixed cost instead.",
  },
] as const;

function toMonthStart(month: string): Date {
  const parsed = parseReportMonth(month);
  if (!parsed) {
    throw new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message: "Invalid month." });
  }
  return parsed.start;
}

function rateView(row: RateRow) {
  return {
    id: row.id,
    driver: row.driver,
    unitCostUsd: row.unitCostUsd,
    effectiveFrom: row.effectiveFrom,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function fixedCostView(row: FixedCostRow) {
  return {
    id: row.id,
    label: row.label,
    monthlyCostUsd: row.monthlyCostUsd,
    allocationKey: row.allocationKey,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

const ZERO_USAGE: TenantUsage = {
  activeMembers: 0,
  memberDays: 0,
  apiRequests: 0,
  apiServerMs: 0,
  storageGb: 0,
  emailsSent: 0,
  customDomains: 0,
};

/**
 * What every tenant cost to serve in one month.
 *
 * Defaults to the current month. A future month is refused rather than answered
 * with zeros, which would look like a real (and very cheap) month.
 */
export async function getCostAttributionReport(
  tx: PlatformTx,
  query: { month?: string | undefined },
  now: Date = new Date(),
): Promise<CostReportResponse> {
  const month = query.month ?? formatReportMonth(now);
  const window = parseReportMonth(month);
  if (!window) {
    throw new AtlasHttpError({ code: "VALIDATION_ERROR", status: 400, message: "Invalid month." });
  }
  if (window.start > now) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "That month has not started yet.",
    });
  }

  const isPartialMonth = window.end > now;
  const snapshotAt = isPartialMonth ? now : window.end;
  const monthWindow = { start: window.start, end: window.end, snapshotAt };

  const [tenantRows, usageByTenant, rateRows, fixedRows] = await Promise.all([
    listTenantsInMonth(tx, monthWindow),
    readUsageByTenant(tx, monthWindow),
    readRatesInForce(tx, window.start),
    readFixedCostsInForce(tx, window.start),
  ]);

  const rates = new Map<CostDriverKey, AttributionRate>(
    rateRows.map((row) => [
      row.driver,
      { unitCostUsd: row.unitCostUsd, effectiveFrom: row.effectiveFrom },
    ]),
  );

  const result = attributeCosts({
    tenants: tenantRows.map((tenant) => ({
      ...tenant,
      usage: usageByTenant.get(tenant.tenantId) ?? { ...ZERO_USAGE },
    })),
    rates,
    fixedCosts: fixedRows.map((row) => ({
      id: row.id,
      label: row.label,
      monthlyCostUsd: row.monthlyCostUsd,
      allocationKey: row.allocationKey,
    })),
  });

  return {
    data: {
      month,
      currency: "USD",
      isPartialMonth,
      snapshotAt: snapshotAt.toISOString(),
      tenants: result.tenants,
      drivers: result.drivers,
      fixedCosts: result.fixedCosts,
      totals: result.totals,
      unpricedDrivers: result.unpricedDrivers,
      notMetered: NOT_METERED.map((entry) => ({ ...entry })),
    },
  };
}

const RATE_HISTORY_LIMIT = 200;

export async function getCostRateCard(
  tx: PlatformTx,
  now: Date = new Date(),
): Promise<CostRateCardResponse> {
  const currentMonth = parseReportMonth(formatReportMonth(now));
  const [inForce, history, fixedCosts] = await Promise.all([
    readRatesInForce(tx, currentMonth?.start ?? now),
    listRateHistory(tx, RATE_HISTORY_LIMIT),
    listFixedCosts(tx),
  ]);
  const current = new Map(inForce.map((row) => [row.driver, row]));

  return {
    data: {
      currency: "USD",
      drivers: COST_DRIVERS.map((driver) => {
        const rate = current.get(driver.key);
        return {
          key: driver.key,
          label: driver.label,
          unit: driver.unit,
          current: rate
            ? { unitCostUsd: rate.unitCostUsd, effectiveFrom: rate.effectiveFrom }
            : null,
          suggestion: driver.suggestion,
        };
      }),
      allocationKeys: ALLOCATION_KEYS.map((key) => ({ key, label: ALLOCATION_KEY_LABELS[key] })),
      rateHistory: history.map(rateView),
      fixedCosts: fixedCosts.map(fixedCostView),
    },
  };
}

export async function setCostRate(tx: PlatformTx, ctx: PlatformCtx, input: SetCostRateRequest) {
  const row = await insertRate(tx, {
    driver: input.driver,
    unitCostUsd: input.unitCostUsd,
    effectiveFrom: toMonthStart(input.effectiveFrom),
    reason: input.reason,
    createdByPrincipalId: ctx.platformPrincipalId,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: null,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.cost_rate.set",
      target: { type: "cost_rate", id: row.id },
      before: null,
      after: {
        driver: row.driver,
        unitCostUsd: input.unitCostUsd,
        effectiveFrom: row.effectiveFrom,
      },
      reason: input.reason,
      metadata: { scope: "global" },
    },
  );

  return { data: rateView(row) };
}

export async function createFixedCost(
  tx: PlatformTx,
  ctx: PlatformCtx,
  input: CreateFixedCostRequest,
) {
  const row = await insertFixedCost(tx, {
    label: input.label,
    monthlyCostUsd: input.monthlyCostUsd,
    allocationKey: input.allocationKey,
    effectiveFrom: toMonthStart(input.effectiveFrom),
    reason: input.reason,
    createdByPrincipalId: ctx.platformPrincipalId,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: null,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.fixed_cost.created",
      target: { type: "fixed_cost", id: row.id },
      before: null,
      after: {
        label: row.label,
        monthlyCostUsd: input.monthlyCostUsd,
        allocationKey: row.allocationKey,
        effectiveFrom: row.effectiveFrom,
      },
      reason: input.reason,
      metadata: { scope: "global" },
    },
  );

  return { data: fixedCostView(row) };
}

export async function endFixedCost(
  tx: PlatformTx,
  ctx: PlatformCtx,
  id: string,
  input: EndFixedCostRequest,
) {
  const existing = await findFixedCost(tx, id);
  if (!existing) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Fixed cost not found.",
    });
  }
  if (existing.effectiveUntil !== null) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "That fixed cost has already been ended.",
    });
  }
  if (input.effectiveUntil < existing.effectiveFrom) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "A fixed cost cannot end before the month it started.",
    });
  }

  const row = await endFixedCostRow(tx, {
    id,
    effectiveUntil: toMonthStart(input.effectiveUntil),
    endedByPrincipalId: ctx.platformPrincipalId,
  });
  // Lost a race with another operator ending the same line.
  if (!row) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "That fixed cost has already been ended.",
    });
  }

  await auditWriter.write(
    tx,
    {
      tenantId: null,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.fixed_cost.ended",
      target: { type: "fixed_cost", id: row.id },
      before: { effectiveUntil: null },
      after: { effectiveUntil: row.effectiveUntil },
      reason: input.reason,
      metadata: { scope: "global" },
    },
  );

  return { data: fixedCostView(row) };
}
