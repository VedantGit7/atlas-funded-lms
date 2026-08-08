import { withTenantTx, type TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { renderReportArtifact, storeReportArtifact } from "./reports-export-runner";
import {
  applyPaymentExportGrouping,
  type PaymentExportGrouping,
} from "./reports-group-subtotals";
import { buildReportDataset } from "./reports.datasets";
import {
  REPORT_GENERATE_REQUESTED_EVENT,
  REPORT_GENERATE_WORKER_DESTINATION,
  REPORT_RUN_SUCCEEDED_EVENT,
  reportGenerateRequestedPayloadSchema,
  reportRunSucceededPayloadSchema,
} from "./reports.events";
import { reportsRepository } from "./reports.repository";
import { getSystemReportDefinition } from "./reports.registry";
import { extractSelectedColumns, filterDatasetByColumns } from "./reports.allowed-columns";
import type { ReportDatasetResult, ServiceCtx } from "./reports.types";

function readGrouping(params: Record<string, unknown>): PaymentExportGrouping {
  const value = params["grouping"];
  if (
    value === "gateway" ||
    value === "product" ||
    value === "currency" ||
    value === "month" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

function stamp(message: string): string {
  return `[${new Date().toISOString()}] ${message}`;
}

async function failRun(
  tx: TenantTx,
  reportRunId: string,
  errorCode: string,
  message: string,
  trace: string[],
): Promise<void> {
  await reportsRepository.markReportRunFailed(tx, {
    reportRunId,
    errorCode,
    message,
    trace: [...trace, stamp(`FATAL: ${message}`), stamp("Job marked as FAILED.")],
  });
}

/**
 * Single-transaction generate (used when already inside a route TX / inline create).
 */
export async function processReportGenerate(
  tx: TenantTx,
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (event.eventType !== REPORT_GENERATE_REQUESTED_EVENT) {
    return;
  }

  const payload = reportGenerateRequestedPayloadSchema.parse(event.payload);
  const existing = await reportsRepository.findReportRunById(tx, payload.reportRunId);
  if (!existing || existing.status === "SUCCEEDED" || existing.status === "FAILED") {
    return;
  }
  if (existing.status === "RUNNING") {
    return;
  }

  const claimed = await reportsRepository.claimReportRunForProcessing(tx, payload.reportRunId);
  if (!claimed) return;

  const trace: string[] = [stamp(`Claimed export job ${payload.reportRunId}`)];
  const definition = await reportsRepository.findDefinitionById(tx, claimed.report_definition_id);
  if (!definition) {
    await failRun(tx, payload.reportRunId, "REPORT_DEFINITION_NOT_FOUND", "Report definition was not found.", trace);
    return;
  }

  const title = getSystemReportDefinition(definition.key)?.title ?? definition.title;

  try {
    const params =
      claimed.params_json && typeof claimed.params_json === "object" && !Array.isArray(claimed.params_json)
        ? (claimed.params_json as Record<string, unknown>)
        : {};

    await reportsRepository.updateReportRunProgress(tx, {
      reportRunId: payload.reportRunId,
      progressPercent: 15,
      stage: "querying",
      trace: [...trace, stamp("Connecting to ledger… OK")],
    });
    trace.push(stamp(`Querying dataset ${definition.dataset_key}…`));

    let dataset = await buildReportDataset(tx, {
      datasetKey: definition.dataset_key,
      params,
    });
    trace.push(stamp(`Dataset ready · ${dataset.rows.length} rows`));

    await reportsRepository.updateReportRunProgress(tx, {
      reportRunId: payload.reportRunId,
      progressPercent: 45,
      stage: "dataset",
      trace,
    });

    dataset = filterAndGroup(definition, params, dataset, trace);

    await reportsRepository.updateReportRunProgress(tx, {
      reportRunId: payload.reportRunId,
      progressPercent: 70,
      stage: "rendering",
      trace: [...trace, stamp(`Rendering ${claimed.format}…`)],
    });

    const rendered = await renderReportArtifact(claimed.format, dataset, title);
    trace.push(stamp(`Render complete · ${rendered.content.byteLength} bytes`));

    await reportsRepository.updateReportRunProgress(tx, {
      reportRunId: payload.reportRunId,
      progressPercent: 88,
      stage: "uploading",
      trace: [...trace, stamp("Uploading artifact…")],
    });

    const stored = await storeReportArtifact(ctx, {
      reportRunId: payload.reportRunId,
      content: rendered.content,
      contentType: rendered.contentType,
      fileExtension: rendered.fileExtension,
    });
    trace.push(stamp("Upload OK"));

    const dataRowCount = dataset.rows.filter((row) => row["_is_subtotal"] !== true).length;
    await reportsRepository.markReportRunSucceeded(tx, {
      reportRunId: payload.reportRunId,
      objectKey: stored.objectKey,
      rowCount: dataRowCount,
      expiresAt: stored.expiresAt,
    });
    trace.push(stamp("Job marked SUCCEEDED"));

    await publishSucceeded(tx, ctx, {
      reportRunId: payload.reportRunId,
      reportDefinitionKey: definition.key,
      format: claimed.format,
      rowCount: dataRowCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export generation failed.";
    await failRun(tx, payload.reportRunId, "REPORT_GENERATION_FAILED", message, trace);
    throw new Error("REPORT_GENERATION_FAILED");
  }
}

function filterAndGroup(
  definition: { scope: string; param_schema_json: unknown; dataset_key: string },
  params: Record<string, unknown>,
  dataset: ReportDatasetResult,
  trace: string[],
): ReportDatasetResult {
  const selectedColumns = extractSelectedColumns(definition.param_schema_json);
  const paramColumns = Array.isArray(params["columns"])
    ? params["columns"].filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  let filtered =
    definition.scope === "tenant" && selectedColumns.length > 0
      ? filterDatasetByColumns(dataset, selectedColumns)
      : paramColumns.length > 0
        ? filterDatasetByColumns(dataset, paramColumns)
        : dataset;

  if (definition.dataset_key === "payments") {
    const grouping = readGrouping(params);
    const includeSubtotals = params["includeSubtotals"] === true;
    if (grouping !== "none") {
      filtered = applyPaymentExportGrouping(filtered, grouping, includeSubtotals);
      trace.push(
        stamp(`Applied grouping=${grouping} subtotals=${includeSubtotals ? "yes" : "no"}`),
      );
    }
  }
  return filtered;
}

async function publishSucceeded(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    reportRunId: string;
    reportDefinitionKey: string;
    format: string;
    rowCount: number;
  },
): Promise<void> {
  const succeededPayload = reportRunSucceededPayloadSchema.parse({
    reportRunId: args.reportRunId,
    reportDefinitionKey: args.reportDefinitionKey,
    format: args.format,
    rowCount: args.rowCount,
    completedAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: REPORT_RUN_SUCCEEDED_EVENT,
    aggregateType: "report_run",
    aggregateId: args.reportRunId,
    payload: succeededPayload,
    idempotencyKey: `${ctx.requestId}:report-ready:${args.reportRunId}`,
  });
}

/**
 * Multi-transaction processing so pollers observe progress_percent between stages.
 */
export async function processReportGenerateStandalone(args: {
  tenantId: string;
  requestId: string;
  actorMembershipId?: string;
  event: { id: string; eventType: string; payload: unknown };
}): Promise<void> {
  if (args.event.eventType !== REPORT_GENERATE_REQUESTED_EVENT) return;

  const payload = reportGenerateRequestedPayloadSchema.parse(args.event.payload);
  const ctx: ServiceCtx = {
    tenantId: args.tenantId,
    actorMembershipId: args.actorMembershipId ?? "00000000-0000-0000-0000-000000000000",
    requestId: args.requestId,
  };
  const txOpts = {
    tenantId: args.tenantId,
    requestId: args.requestId,
    allowAnonymousTenantRead: true as const,
  };

  const claimed = await withTenantTx(txOpts, async (tx) => {
    const existing = await reportsRepository.findReportRunById(tx, payload.reportRunId);
    if (!existing || existing.status !== "QUEUED") return null;
    return reportsRepository.claimReportRunForProcessing(tx, payload.reportRunId);
  });
  if (!claimed) return;

  const trace: string[] = [stamp(`Claimed export job ${payload.reportRunId}`)];

  try {
    const prepared = await withTenantTx(txOpts, async (tx) => {
      const definition = await reportsRepository.findDefinitionById(
        tx,
        claimed.report_definition_id,
      );
      if (!definition) {
        await failRun(
          tx,
          payload.reportRunId,
          "REPORT_DEFINITION_NOT_FOUND",
          "Report definition was not found.",
          trace,
        );
        return null;
      }

      const params =
        claimed.params_json &&
        typeof claimed.params_json === "object" &&
        !Array.isArray(claimed.params_json)
          ? (claimed.params_json as Record<string, unknown>)
          : {};

      await reportsRepository.updateReportRunProgress(tx, {
        reportRunId: payload.reportRunId,
        progressPercent: 15,
        stage: "querying",
        trace: [...trace, stamp("Connecting to ledger… OK")],
      });
      trace.push(stamp(`Querying dataset ${definition.dataset_key}…`));

      let dataset = await buildReportDataset(tx, {
        datasetKey: definition.dataset_key,
        params,
      });
      trace.push(stamp(`Dataset ready · ${dataset.rows.length} rows`));

      await reportsRepository.updateReportRunProgress(tx, {
        reportRunId: payload.reportRunId,
        progressPercent: 45,
        stage: "dataset",
        trace,
      });

      dataset = filterAndGroup(definition, params, dataset, trace);

      return {
        definition,
        params,
        dataset,
        title: getSystemReportDefinition(definition.key)?.title ?? definition.title,
      };
    });

    if (!prepared) return;

    const rendered = await (async () => {
      await withTenantTx(txOpts, async (tx) => {
        await reportsRepository.updateReportRunProgress(tx, {
          reportRunId: payload.reportRunId,
          progressPercent: 70,
          stage: "rendering",
          trace: [...trace, stamp(`Rendering ${claimed.format}…`)],
        });
      });
      const artifact = await renderReportArtifact(
        claimed.format,
        prepared.dataset,
        prepared.title,
      );
      trace.push(stamp(`Render complete · ${artifact.content.byteLength} bytes`));
      return artifact;
    })();

    await withTenantTx(txOpts, async (tx) => {
      await reportsRepository.updateReportRunProgress(tx, {
        reportRunId: payload.reportRunId,
        progressPercent: 88,
        stage: "uploading",
        trace: [...trace, stamp("Uploading artifact…")],
      });

      const stored = await storeReportArtifact(ctx, {
        reportRunId: payload.reportRunId,
        content: rendered.content,
        contentType: rendered.contentType,
        fileExtension: rendered.fileExtension,
      });
      trace.push(stamp("Upload OK"));

      const dataRowCount = prepared.dataset.rows.filter(
        (row) => row["_is_subtotal"] !== true,
      ).length;
      await reportsRepository.markReportRunSucceeded(tx, {
        reportRunId: payload.reportRunId,
        objectKey: stored.objectKey,
        rowCount: dataRowCount,
        expiresAt: stored.expiresAt,
      });
      trace.push(stamp("Job marked SUCCEEDED"));

      await publishSucceeded(tx, ctx, {
        reportRunId: payload.reportRunId,
        reportDefinitionKey: prepared.definition.key,
        format: claimed.format,
        rowCount: dataRowCount,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export generation failed.";
    await withTenantTx(txOpts, async (tx) => {
      await failRun(tx, payload.reportRunId, "REPORT_GENERATION_FAILED", message, trace);
    });
    throw new Error("REPORT_GENERATION_FAILED");
  }
}

export async function handleReportsOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Reports worker requires tenant-scoped events.");
  }

  const parsed =
    event.eventType === REPORT_GENERATE_REQUESTED_EVENT
      ? reportGenerateRequestedPayloadSchema.safeParse(event.payload)
      : null;

  await processReportGenerateStandalone({
    tenantId: event.tenantId,
    requestId: event.requestId,
    ...(parsed?.success
      ? { actorMembershipId: parsed.data.requestedByMembershipId }
      : {}),
    event,
  });
}

export const reportsOutboxHandlers = [
  {
    destinationKey: REPORT_GENERATE_WORKER_DESTINATION,
    handle: handleReportsOutboxEvent,
  },
];

export const REPORTS_OUTBOX_EVENTS = [REPORT_GENERATE_REQUESTED_EVENT] as const;
export { REPORT_GENERATE_WORKER_DESTINATION };
