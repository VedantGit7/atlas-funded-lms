import type { TenantTx } from "@atlas/db";
import { listActiveEntitlements } from "../repositories/entitlement.repository";
import { listTenantSubscriptionRows } from "../repositories/subscription.repository";
import { resolveUsageLimits } from "../usage-limits";
import {
  getMauDaily,
  getMauMonthly,
  getUsageCounterHistory,
  getUsageGaugeHistory,
  getUsageTierAMetrics,
  upsertUsageSnapshot,
  USAGE_COUNTER_KEYS,
  USAGE_SNAPSHOT_KEYS,
  type UsageTierAMetrics,
} from "../repositories/usage.repository";
import type { UsageHistoryEntry, UsageSummaryResponse } from "../schemas/usage";

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function roundGb(value: number): number {
  return Math.round(value * 100) / 100;
}

/** First-of-month key ("YYYY-MM-01") for `offset` months before the current month. */
function monthKey(offset: number): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - offset);
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function currentMonthEntry(
  metrics: UsageTierAMetrics,
  messageSends: number,
  emailValidations: number,
): UsageHistoryEntry {
  return {
    period: monthKey(0),
    storageGb: roundGb(metrics.storageGb),
    totalLearners: metrics.totalLearners,
    products: metrics.products,
    questions: metrics.questions,
    testSubmits: metrics.testSubmits,
    messageSends,
    emailValidations,
  };
}

/**
 * Assembles the Usage Insights payload. MAU history and comparison come from the
 * `tenant_active_days` markers (real, auto-accruing). Gauge history comes from
 * monthly snapshots in analytics_rollups, with the current month always overlaid
 * with live values so it is accurate even before the snapshot job runs. Metrics
 * that need a dedicated metering pipeline (bandwidth, video, DRM, messaging)
 * remain zero until that instrumentation lands.
 */
export async function getUsageSummary(tx: TenantTx): Promise<UsageSummaryResponse> {
  const [
    metrics,
    subscriptionRows,
    mauMonthly,
    mauDaily,
    gaugeHistory,
    counterHistory,
    entitlements,
  ] = await Promise.all([
    getUsageTierAMetrics(tx),
    listTenantSubscriptionRows(tx),
    getMauMonthly(tx),
    getMauDaily(tx),
    getUsageGaugeHistory(tx),
    getUsageCounterHistory(tx),
    listActiveEntitlements(tx),
  ]);

  const subscription = subscriptionRows[0] ?? null;
  const storageGb = roundGb(metrics.storageGb);
  const limits = resolveUsageLimits(subscription?.plan_name ?? null, entitlements);

  const monthlyByPeriod = new Map(mauMonthly.map((point) => [point.period, point.value]));
  const comparison = {
    current: monthlyByPeriod.get(monthKey(0)) ?? metrics.currentMau,
    m1: monthlyByPeriod.get(monthKey(1)) ?? null,
    m3: monthlyByPeriod.get(monthKey(3)) ?? null,
    m6: monthlyByPeriod.get(monthKey(6)) ?? null,
    m9: monthlyByPeriod.get(monthKey(9)) ?? null,
  };

  const historyByPeriod = new Map<string, UsageHistoryEntry>();
  const emptyEntry = (period: string): UsageHistoryEntry => ({
    period,
    storageGb: 0,
    totalLearners: 0,
    products: 0,
    questions: 0,
    testSubmits: 0,
    messageSends: 0,
    emailValidations: 0,
  });

  for (const row of gaugeHistory) {
    const entry = historyByPeriod.get(row.period) ?? emptyEntry(row.period);
    if (row.rollupKey === USAGE_SNAPSHOT_KEYS.storageGb) entry.storageGb = roundGb(row.value);
    if (row.rollupKey === USAGE_SNAPSHOT_KEYS.totalLearners)
      entry.totalLearners = Math.round(row.value);
    if (row.rollupKey === USAGE_SNAPSHOT_KEYS.products) entry.products = Math.round(row.value);
    if (row.rollupKey === USAGE_SNAPSHOT_KEYS.questions) entry.questions = Math.round(row.value);
    if (row.rollupKey === USAGE_SNAPSHOT_KEYS.testSubmits)
      entry.testSubmits = Math.round(row.value);
    historyByPeriod.set(row.period, entry);
  }

  for (const row of counterHistory) {
    const entry = historyByPeriod.get(row.period) ?? emptyEntry(row.period);
    if (row.rollupKey === USAGE_COUNTER_KEYS.messageSends)
      entry.messageSends = Math.round(row.value);
    if (row.rollupKey === USAGE_COUNTER_KEYS.emailValidations) {
      entry.emailValidations = Math.round(row.value);
    }
    historyByPeriod.set(row.period, entry);
  }

  const currentCounters = historyByPeriod.get(monthKey(0));
  const currentMessageSends = currentCounters?.messageSends ?? 0;
  const currentEmailValidations = currentCounters?.emailValidations ?? 0;

  // The current month always reflects live gauge values, snapshot or not.
  historyByPeriod.set(
    monthKey(0),
    currentMonthEntry(metrics, currentMessageSends, currentEmailValidations),
  );
  const history = [...historyByPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));

  return {
    data: {
      plan: {
        name: subscription?.plan_name ?? null,
        startedAt: subscription ? toIsoOrNull(subscription.created_at) : null,
        nextBillingAt: subscription ? toIsoOrNull(subscription.next_billing_at) : null,
      },
      limits,
      kpis: {
        averageMau: metrics.currentMau,
        totalLearners: metrics.totalLearners,
        totalVideoHours: 0,
        totalStorageGb: storageGb,
      },
      current: {
        bandwidthGb: 0,
        testSubmits: metrics.testSubmits,
        drmTokens: 0,
        messageSends: currentMessageSends,
        emailValidations: currentEmailValidations,
        totalLearners: metrics.totalLearners,
        contentStorageGb: storageGb,
        products: metrics.products,
        videoTranscodingHours: 0,
        questions: metrics.questions,
      },
      mau: {
        monthly: mauMonthly,
        daily: mauDaily,
        comparison,
      },
      history,
    },
  };
}

/**
 * Records the current month's Tier-A gauge snapshot into analytics_rollups.
 * Idempotent — safe to call from a nightly job or on demand.
 */
export async function runUsageSnapshot(tx: TenantTx): Promise<void> {
  const metrics = await getUsageTierAMetrics(tx);
  await Promise.all([
    upsertUsageSnapshot(tx, USAGE_SNAPSHOT_KEYS.storageGb, roundGb(metrics.storageGb)),
    upsertUsageSnapshot(tx, USAGE_SNAPSHOT_KEYS.totalLearners, metrics.totalLearners),
    upsertUsageSnapshot(tx, USAGE_SNAPSHOT_KEYS.products, metrics.products),
    upsertUsageSnapshot(tx, USAGE_SNAPSHOT_KEYS.questions, metrics.questions),
    upsertUsageSnapshot(tx, USAGE_SNAPSHOT_KEYS.testSubmits, metrics.testSubmits),
  ]);
}
