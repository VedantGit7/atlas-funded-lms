import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  POLL_EXPORT_DATASETS,
  POLL_NON_RESPONDENTS_EXPORT_COLUMNS,
  POLL_OPTION_TALLIES_EXPORT_COLUMNS,
  POLL_RESPONDENTS_EXPORT_COLUMNS,
  POLL_SUMMARY_EXPORT_COLUMNS,
  createPollExportBodySchema,
  createPollExportResponseSchema,
  pollExportRunDetailResponseSchema,
  pollsExportsResponseSchema,
  retryPollExportResponseSchema,
  updatePollExportScheduleResponseSchema,
  type CreatePollExportBody,
} from "./polls-exports.dto";
import {
  createReportRun,
  createReportSchedule,
  ensureTenantReportDefinitions,
  listReportRuns,
  listReportSchedules,
} from "./reports.service";
import {
  createExportOperations,
  cronFromCadence,
  describeExportRun,
  describeExportSchedule,
  formatDateShort,
  type ExportRun,
  type ExportScheduleView,
  type ExportViewSpec,
} from "./report-exports.kit";
import {
  deleteReportExportScheduleResponseSchema,
  updateReportExportScheduleBodySchema,
} from "./report-exports.dto";

const DEFINITION_KEY = "polls";

type PollExportDataset = (typeof POLL_EXPORT_DATASETS)[number];

function datasetLabel(dataset: PollExportDataset): string {
  if (dataset === "poll_summary") return "Poll summary";
  if (dataset === "option_tallies") return "Option tallies";
  if (dataset === "non_respondents") return "Non-respondents";
  return "Respondents";
}

function normalizeDataset(value: unknown): PollExportDataset {
  if (typeof value === "string" && (POLL_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as PollExportDataset;
  }
  return "respondents";
}

function fileNameFor(dataset: PollExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const slug =
    dataset === "poll_summary"
      ? "summary"
      : dataset === "option_tallies"
        ? "tallies"
        : dataset === "non_respondents"
          ? "non-respondents"
          : "respondents";
  return `poll-${slug}-${stamp}.${format === "json" ? "json" : format}`;
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  if (typeof params["filterSummary"] === "string" && params["filterSummary"].trim()) {
    return params["filterSummary"].trim();
  }
  const parts: string[] = [];
  if (params["allPollsInSession"] === true) {
    parts.push("All polls in session");
  } else if (params["allPollsInRange"] === true) {
    parts.push("All polls in range");
  } else {
    const pollIds = params["pollIds"];
    const pollId = params["pollId"];
    if (Array.isArray(pollIds) && pollIds.length > 0) {
      parts.push(pollIds.length === 1 ? "1 poll" : `${String(pollIds.length)} polls`);
    } else if (typeof pollId === "string" && pollId.trim()) {
      parts.push("1 poll");
    } else {
      parts.push("All polls");
    }
  }
  if (typeof params["liveSessionId"] === "string" && params["liveSessionId"].trim()) {
    parts.push("Live session scoped");
  }
  const from = formatDateShort(
    typeof params["respondedFrom"] === "string" ? params["respondedFrom"] : undefined,
  );
  const to = formatDateShort(
    typeof params["respondedTo"] === "string" ? params["respondedTo"] : undefined,
  );
  if (from && to) parts.push(`${from} – ${to}`);
  else if (from) parts.push(`from ${from}`);
  else if (to) parts.push(`until ${to}`);
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the poll artifact. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Polls report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

const view: ExportViewSpec<PollExportDataset> = {
  datasetParams: ["reportTab", "dataset"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: true,
  historyExtras: (params) => ({ anonymousExcludedCount: anonymousExcludedFromParams(params) }),
  defaultScheduleName: "Poll export",
  cadenceWording: "friday-weekly",
  scheduleDataset: false,
  webhookLabel: "webhook",
};

function mapHistoryItem(run: ExportRun, actorMembershipId = "") {
  return describeExportRun(view, run, actorMembershipId);
}

function mapScheduleItem(schedule: ExportScheduleView) {
  return describeExportSchedule(view, schedule);
}

const operations = createExportOperations({
  definitionKey: DEFINITION_KEY,
  describeRun: mapHistoryItem,
  describeSchedule: mapScheduleItem,
  retryProcessInline: true,
  schemas: {
    runDetail: pollExportRunDetailResponseSchema,
    retry: retryPollExportResponseSchema,
    updateScheduleBody: updateReportExportScheduleBodySchema,
    updateSchedule: updatePollExportScheduleResponseSchema,
    deleteSchedule: deleteReportExportScheduleResponseSchema,
  },
});

function anonymousExcludedFromParams(params: Record<string, unknown>): number | null {
  const value = params["anonymousExcludedCount"];
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return null;
}

function buildRunParams(body: CreatePollExportBody): Record<string, unknown> {
  const params: Record<string, unknown> = {
    reportTab: body.dataset,
    dataset: body.dataset,
    columns: body.columns,
    grouping: body.grouping,
    includeSubtotals: body.includeSubtotals,
  };
  if (body.allPollsInSession) params["allPollsInSession"] = true;
  if (body.allPollsInRange) params["allPollsInRange"] = true;
  if (body.liveSessionId) params["liveSessionId"] = body.liveSessionId;
  if (body.pollIds && body.pollIds.length > 0) {
    params["pollIds"] = body.pollIds;
    if (body.pollIds.length === 1) params["pollId"] = body.pollIds[0];
  }
  if (body.respondedFrom) params["respondedFrom"] = body.respondedFrom;
  if (body.respondedTo) params["respondedTo"] = body.respondedTo;
  if (body.filterSummary?.trim()) params["filterSummary"] = body.filterSummary.trim();
  if (body.delivery === "email_me") {
    params["emailDownloadLink"] = true;
    params["deliveryMode"] = "email_me";
  } else if (body.delivery === "recipients") {
    params["deliveryMode"] = "recipients";
    if (body.recipients && body.recipients.length > 0) {
      params["deliveryEmails"] = body.recipients;
    }
  }
  if (body.webhookUrl?.trim()) params["webhookUrl"] = body.webhookUrl.trim();
  return params;
}

export async function getPollsExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
  ]);

  const history = runs.data.items.map((run) =>
    mapHistoryItem(
      {
        id: run.id,
        format: run.format,
        params: run.params,
        rowCount: run.rowCount,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        expiresAt: run.expiresAt,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        errorTrace: run.errorTrace,
        progressPercent: run.progressPercent,
        requestedByMembershipId: run.requestedByMembershipId,
        scheduleId: run.scheduleId,
      },
      ctx.actorMembershipId,
    ),
  );

  const pollSchedules = schedules.data.items
    .filter((item) => item.definitionKey === DEFINITION_KEY)
    .map((item) =>
      mapScheduleItem({
        id: item.id,
        name: item.name,
        definitionTitle: item.definitionTitle,
        cronExpression: item.cronExpression,
        timezone: item.timezone,
        formats: item.formats,
        isActive: item.isActive,
        nextRunAt: item.nextRunAt,
        params: item.params,
        delivery: item.delivery,
      }),
    );

  return pollsExportsResponseSchema.parse({
    data: {
      history,
      schedules: pollSchedules,
      summaryColumns: POLL_SUMMARY_EXPORT_COLUMNS.map((column) => ({ ...column })),
      optionTalliesColumns: POLL_OPTION_TALLIES_EXPORT_COLUMNS.map((column) => ({
        ...column,
      })),
      respondentsColumns: POLL_RESPONDENTS_EXPORT_COLUMNS.map((column) => ({ ...column })),
      nonRespondentsColumns: POLL_NON_RESPONDENTS_EXPORT_COLUMNS.map((column) => ({
        ...column,
      })),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...POLL_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        note: "Exports generate from the polls dataset. Anonymous polls never produce identity columns for Respondents. Ready files expire after the signed download TTL (typically 7 days).",
      },
    },
  });
}

export async function createPollExport(tx: TenantTx, ctx: ServiceCtx, input: CreatePollExportBody) {
  const body = createPollExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.delivery === "recipients" && (!body.recipients || body.recipients.length === 0)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Add at least one recipient email for recipient delivery.",
    });
  }

  if (body.allPollsInSession && !body.liveSessionId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Select a live session when exporting all polls in a session.",
    });
  }

  const params = buildRunParams(body);

  const runResult = await createReportRun(
    tx,
    ctx,
    {
      definitionKey: DEFINITION_KEY,
      format: body.format,
      params,
    },
    { processInline: true },
  );

  let schedule = null;
  if (body.scheduleEnabled) {
    const cadence = body.cadence ?? "weekly";
    const time = body.time ?? "17:00";
    const timezone = body.timezone ?? "Asia/Kolkata";
    const scheduleResult = await createReportSchedule(tx, ctx, {
      definitionKey: DEFINITION_KEY,
      name: body.scheduleName?.trim() || `Weekly ${datasetLabel(body.dataset)} export`,
      cronExpression: cronFromCadence(cadence, time, 5),
      timezone,
      params,
      formats: [body.format],
      delivery: {
        mode: body.delivery,
        emails: body.recipients ?? [],
        webhookUrl: body.webhookUrl ?? null,
      },
      isActive: true,
    });
    schedule = mapScheduleItem({
      id: scheduleResult.data.id,
      name: scheduleResult.data.name,
      definitionTitle: scheduleResult.data.definitionTitle,
      cronExpression: scheduleResult.data.cronExpression,
      timezone: scheduleResult.data.timezone,
      formats: scheduleResult.data.formats,
      isActive: scheduleResult.data.isActive,
      nextRunAt: scheduleResult.data.nextRunAt,
      params: scheduleResult.data.params,
      delivery: scheduleResult.data.delivery,
    });
  }

  return createPollExportResponseSchema.parse({
    data: {
      run: mapHistoryItem(
        {
          id: runResult.data.id,
          format: runResult.data.format,
          params: runResult.data.params,
          rowCount: runResult.data.rowCount,
          status: runResult.data.status,
          createdAt: runResult.data.createdAt,
          completedAt: runResult.data.completedAt,
          expiresAt: runResult.data.expiresAt,
          errorCode: runResult.data.errorCode,
          errorMessage: runResult.data.errorMessage,
          errorTrace: runResult.data.errorTrace,
          progressPercent: runResult.data.progressPercent,
          requestedByMembershipId: runResult.data.requestedByMembershipId,
          scheduleId: runResult.data.scheduleId,
        },
        ctx.actorMembershipId,
      ),
      schedule,
    },
  });
}

export const getPollExportRun = operations.getRun;
export const retryPollExport = operations.retry;
export const updatePollExportSchedule = operations.updateSchedule;
export const deletePollExportSchedule = operations.deleteSchedule;
