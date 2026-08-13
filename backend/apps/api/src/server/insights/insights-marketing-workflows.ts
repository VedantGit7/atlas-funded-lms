import type { InsightMarketingWorkflowsBoard } from "./insights.schemas";

export const MARKETING_WORKFLOWS_EMPTY = "No workflows published";
export const MARKETING_WORKFLOWS_HREF = "/admin/marketing/workflows";
export const MARKETING_WORKFLOWS_FAILURE_SHARE_WARN = 20;
export const MARKETING_WORKFLOWS_FAILURE_MIN_RUNS = 3;
export const MARKETING_WORKFLOWS_VOLUME_ALL_HEALTHY =
  "All automation runs succeeded in this window.";
export const MARKETING_WORKFLOWS_NEVER_RUN_CAPTION =
  "Published workflows with no runs usually mean the trigger has not occurred yet.";
export const MARKETING_WORKFLOWS_NEVER_RUN_EMPTY =
  "Every published workflow has run in this window.";

export type MarketingWorkflowsDailyVolumeInput = {
  period: string;
  completed: number;
  failed: number;
  total: number;
};

export type MarketingWorkflowsByWorkflowInput = {
  id: string;
  title: string;
  status: string;
  runs30d: number;
  completed30d: number;
  failed30d: number;
  lastRunAt: string | null;
  publishedAt: string | null;
  href: string;
};

export type MarketingWorkflowsNeverRunInput = {
  id: string;
  title: string;
  publishedAt: string | null;
  href: string;
};

export type MarketingWorkflowsTriggerInput = {
  trigger: string;
  runs: number;
};

export type MarketingWorkflowsLedgerInput = {
  id: string;
  workflowId: string;
  workflowTitle: string;
  status: string;
  triggerEventType: string;
  createdAt: string;
  errorMessage: string | null;
  href: string;
  workflowHref: string;
};

export type MarketingWorkflowsSnapshotInput = {
  workflowCount: number;
  publishedWorkflowCount: number;
  runs30d: number;
  runsCompleted30d: number;
  runsFailed30d: number;
  lastRunAt: string | null;
  dailyVolume: MarketingWorkflowsDailyVolumeInput[];
  byWorkflow: MarketingWorkflowsByWorkflowInput[];
  neverRun: MarketingWorkflowsNeverRunInput[];
  triggers: MarketingWorkflowsTriggerInput[];
  ledger: MarketingWorkflowsLedgerInput[];
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function plural(count: number, singular: string, pluralWord: string): string {
  return count === 1 ? singular : pluralWord;
}

function successRatePct(completed: number, failed: number): number | null {
  const finished = completed + failed;
  if (finished <= 0) return null;
  return round1((completed / finished) * 100);
}

function failureSharePct(failed: number, runs: number): number | null {
  if (runs <= 0) return null;
  return round1((failed / runs) * 100);
}

function formatPeriodLabel(period: string): string {
  const date = new Date(`${period}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function buildVolumeCaption(
  dailyVolume: MarketingWorkflowsDailyVolumeInput[],
  runs30d: number,
  runsFailed30d: number,
  allHealthy: boolean,
): { caption: string; allHealthyCaption: string | null } {
  if (allHealthy && runs30d > 0) {
    return {
      caption: MARKETING_WORKFLOWS_VOLUME_ALL_HEALTHY,
      allHealthyCaption: MARKETING_WORKFLOWS_VOLUME_ALL_HEALTHY,
    };
  }

  const daysWithRuns = dailyVolume.filter((day) => day.total > 0);
  if (daysWithRuns.length === 0) {
    return { caption: "No workflow runs in the last 30 days.", allHealthyCaption: null };
  }

  const busiest = daysWithRuns.reduce((best, day) => (day.total > best.total ? day : best));
  const overallFailureRate = runs30d > 0 ? runsFailed30d / runs30d : 0;

  let unusualDay: MarketingWorkflowsDailyVolumeInput | null = null;
  let unusualShare = 0;
  for (const day of daysWithRuns) {
    if (day.total < MARKETING_WORKFLOWS_FAILURE_MIN_RUNS) continue;
    const share = day.failed / day.total;
    if (share >= MARKETING_WORKFLOWS_FAILURE_SHARE_WARN / 100 && share > unusualShare) {
      unusualDay = day;
      unusualShare = share;
    } else if (
      overallFailureRate > 0 &&
      day.total >= MARKETING_WORKFLOWS_FAILURE_MIN_RUNS &&
      share >= overallFailureRate * 2 &&
      share > unusualShare
    ) {
      unusualDay = day;
      unusualShare = share;
    }
  }

  const parts = [
    `Busiest day: ${formatPeriodLabel(busiest.period)} (${String(busiest.total)} ${plural(busiest.total, "run", "runs")}).`,
  ];
  if (unusualDay && unusualDay.failed > 0) {
    parts.push(
      `Unusual failure share on ${formatPeriodLabel(unusualDay.period)} (${round1(unusualShare * 100)}% failed).`,
    );
  }

  return { caption: parts.join(" "), allHealthyCaption: null };
}

function mapByWorkflow(
  rows: MarketingWorkflowsByWorkflowInput[],
  totalRuns30d: number,
): InsightMarketingWorkflowsBoard["byWorkflow"] {
  return rows.map((row) => {
    const finishedRate = successRatePct(row.completed30d, row.failed30d);
    const sharePct = totalRuns30d > 0 ? round1((row.runs30d / totalRuns30d) * 100) : null;
    const failShare = failureSharePct(row.failed30d, row.runs30d);
    const warningRail =
      row.runs30d >= MARKETING_WORKFLOWS_FAILURE_MIN_RUNS &&
      failShare != null &&
      failShare >= MARKETING_WORKFLOWS_FAILURE_SHARE_WARN;

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      runs30d: row.runs30d,
      failed30d: row.failed30d,
      runSharePct: sharePct,
      successRatePct: finishedRate,
      lastRunAt: row.lastRunAt,
      publishedAt: row.publishedAt,
      href: row.href,
      warningRail,
    };
  });
}

function mapTriggers(
  triggers: MarketingWorkflowsTriggerInput[],
  totalRuns30d: number,
): InsightMarketingWorkflowsBoard["triggers"] {
  return triggers.map((row) => ({
    trigger: row.trigger,
    runs: row.runs,
    sharePct: totalRuns30d > 0 ? round1((row.runs / totalRuns30d) * 100) : null,
  }));
}

function mapLedger(
  ledger: MarketingWorkflowsLedgerInput[],
): InsightMarketingWorkflowsBoard["ledger"] {
  return ledger.map((row) => ({
    id: row.id,
    workflowId: row.workflowId,
    workflowTitle: row.workflowTitle,
    status: row.status,
    triggerEventType: row.triggerEventType,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    errorPreview: row.errorMessage
      ? (row.errorMessage.split(/\r?\n/)[0]?.trim().slice(0, 160) ?? null)
      : null,
    href: row.href,
    workflowHref: row.workflowHref,
    isFailed: row.status.toUpperCase() === "FAILED",
  }));
}

export function buildInsightMarketingWorkflows(
  snapshot: MarketingWorkflowsSnapshotInput,
  generatedAt = new Date().toISOString(),
): InsightMarketingWorkflowsBoard {
  const empty = snapshot.publishedWorkflowCount <= 0;
  const allHealthy = snapshot.runsFailed30d === 0 && snapshot.runs30d > 0;
  const rate = successRatePct(snapshot.runsCompleted30d, snapshot.runsFailed30d);
  const volume = buildVolumeCaption(
    snapshot.dailyVolume,
    snapshot.runs30d,
    snapshot.runsFailed30d,
    allHealthy,
  );

  const runsCaption =
    snapshot.publishedWorkflowCount > 0
      ? `across ${String(snapshot.publishedWorkflowCount)} published ${plural(snapshot.publishedWorkflowCount, "workflow", "workflows")}`
      : "no published workflows";

  return {
    slug: "marketing-insight",
    title: "Workflows",
    subtitle: "What the marketing automation has been doing.",
    generatedAt,
    empty,
    allHealthy,
    emptyCaption: MARKETING_WORKFLOWS_EMPTY,
    manageWorkflowsHref: MARKETING_WORKFLOWS_HREF,
    failureShareWarnThreshold: MARKETING_WORKFLOWS_FAILURE_SHARE_WARN,
    failureMinRuns: MARKETING_WORKFLOWS_FAILURE_MIN_RUNS,
    workflowCount: snapshot.workflowCount,
    publishedWorkflowCount: snapshot.publishedWorkflowCount,
    runs30d: snapshot.runs30d,
    runsCompleted30d: snapshot.runsCompleted30d,
    runsFailed30d: snapshot.runsFailed30d,
    successRatePct: rate,
    lastRunAt: snapshot.lastRunAt,
    runsCaption,
    volumeCaption: volume.caption,
    volumeAllHealthyCaption: volume.allHealthyCaption,
    neverRunCaption:
      snapshot.neverRun.length > 0
        ? MARKETING_WORKFLOWS_NEVER_RUN_CAPTION
        : MARKETING_WORKFLOWS_NEVER_RUN_EMPTY,
    dailyVolume: snapshot.dailyVolume,
    byWorkflow: mapByWorkflow(snapshot.byWorkflow, snapshot.runs30d),
    triggers: mapTriggers(snapshot.triggers, snapshot.runs30d),
    neverRun: snapshot.neverRun,
    ledger: mapLedger(snapshot.ledger),
  };
}

export function marketingWorkflowsToCsv(board: InsightMarketingWorkflowsBoard): string {
  const lines = [
    "Metric,Value",
    `Runs (30d),${String(board.runs30d)}`,
    `Published workflows,${String(board.publishedWorkflowCount)}`,
    `Failed runs (30d),${String(board.runsFailed30d)}`,
    `Success rate %,${board.successRatePct == null ? "-" : `${board.successRatePct}%`}`,
    `Last run,${board.lastRunAt ?? "Never"}`,
    "",
    "Day,Completed,Failed,Total",
    ...board.dailyVolume.map((day) =>
      [day.period, String(day.completed), String(day.failed), String(day.total)].join(","),
    ),
    "",
    "Workflow,Status,Runs (30d),Failed (30d),Success rate %,Last run",
    ...board.byWorkflow.map((row) =>
      [
        row.title,
        row.status,
        String(row.runs30d),
        String(row.failed30d),
        row.successRatePct == null ? "-" : `${row.successRatePct}%`,
        row.lastRunAt ?? "Never",
      ].join(","),
    ),
    "",
    "Trigger,Runs,Share %",
    ...board.triggers.map((row) =>
      [row.trigger, String(row.runs), row.sharePct == null ? "-" : `${row.sharePct}%`].join(","),
    ),
    "",
    "Workflow,Status,Trigger,Created,Error",
    ...board.ledger.map((row) =>
      [
        row.workflowTitle,
        row.status,
        row.triggerEventType,
        row.createdAt,
        row.errorPreview ?? "",
      ].join(","),
    ),
  ];

  return lines.join("\n");
}
