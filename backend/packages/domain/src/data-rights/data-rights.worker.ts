import { withTenantTx } from "@atlas/db";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import { storeExportArtifact } from "./export-artifact";
import { spoolTenantExport, ExportLimitError, type ExportSpool } from "./export-spool";
import { readExportPage } from "./export-pages.repository";
import { DEFAULT_EXPORT_SETTINGS, exportSettingsSchema } from "../reports/export-settings.dto";
import {
  DATA_EXPORT_REQUESTED_EVENT,
  DATA_EXPORT_WORKER_DESTINATION,
  dataExportRequestedPayloadSchema,
} from "./data-rights.events";
import { dataRightsRepository } from "./data-rights.repository";
import type { ServiceCtx } from "./data-rights.types";

export async function processExportRequestedEvent(
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (event.eventType !== DATA_EXPORT_REQUESTED_EVENT) {
    return;
  }

  const payload = dataExportRequestedPayloadSchema.parse(event.payload);
  const txOptions = {
    tenantId: ctx.tenantId,
    requestId: ctx.requestId,
    allowAnonymousTenantRead: true as const,
  };
  const claimed = await withTenantTx(txOptions, async (tx) => {
    const existing = await dataRightsRepository.findExportJobById(tx, payload.exportJobId);
    if (!existing) throw new OutboxDeliveryError("permanent", "EXPORT_JOB_NOT_FOUND");
    if (existing.status === "SUCCEEDED") return null;
    if (existing.status === "RUNNING") {
      // A lost outbox lease does not prove the previous uploader has stopped.
      throw new OutboxDeliveryError("reconciliation_required", "EXPORT_JOB_ALREADY_RUNNING");
    }
    if (existing.status !== "QUEUED") {
      throw new OutboxDeliveryError("permanent", "EXPORT_JOB_TERMINAL");
    }
    const job = await dataRightsRepository.claimExportJobForProcessing(tx, payload.exportJobId);
    if (!job) throw new OutboxDeliveryError("retryable", "EXPORT_JOB_CLAIM_CONFLICT");
    return job;
  });
  if (!claimed) return;

  let file: ExportSpool | undefined;
  try {
    const settings = await withTenantTx(txOptions, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ settings_json: unknown }>>`
        select settings_json from report_export_settings
        where tenant_id = ${ctx.tenantId}::uuid limit 1
      `;
      return rows[0] ? exportSettingsSchema.parse(rows[0].settings_json) : DEFAULT_EXPORT_SETTINGS;
    });
    file = await spoolTenantExport(
      ctx,
      (section, cursor) =>
        withTenantTx(txOptions, (tx) => readExportPage(tx, ctx.tenantId, section, cursor)),
      { maxRows: Math.min(settings.maxRowsPerExport, 100_000), maxBytes: 64 * 1024 * 1024 },
    );
    const stored = await storeExportArtifact(ctx, {
      exportJobId: payload.exportJobId,
      file,
      retentionMs:
        settings.fileRetentionValue *
        (settings.fileRetentionUnit === "hours" ? 3_600_000 : 86_400_000),
      onPrepared: (prepared) =>
        withTenantTx(txOptions, (tx) =>
          dataRightsRepository.registerExportArtifact(tx, {
            exportJobId: payload.exportJobId,
            ...prepared,
          }),
        ),
    });

    await withTenantTx(txOptions, async (tx) => {
      if (!(await dataRightsRepository.lockRunningExportJob(tx, payload.exportJobId))) {
        throw new OutboxDeliveryError("permanent", "EXPORT_JOB_NOT_RUNNING");
      }
      const completed = await dataRightsRepository.markExportJobSucceeded(tx, {
        exportJobId: payload.exportJobId,
        objectKey: stored.objectKey,
        expiresAt: stored.expiresAt,
        artifact: stored.artifact,
      });
      if (!completed) throw new OutboxDeliveryError("permanent", "EXPORT_JOB_NOT_RUNNING");
    });
  } catch (error) {
    const failure =
      error instanceof OutboxDeliveryError
        ? error
        : error instanceof ExportLimitError
          ? new OutboxDeliveryError("permanent", error.message)
          : new OutboxDeliveryError("retryable", "EXPORT_GENERATION_FAILED");
    // A remote upload with an unknown outcome must not be overwritten or cleaned
    // up while it could still complete. Other I/O has stopped before requeue.
    if (failure.kind !== "reconciliation_required") {
      await withTenantTx(txOptions, (tx) =>
        dataRightsRepository.markExportWriterStopped(tx, payload.exportJobId),
      );
    }
    if (failure.kind === "retryable") {
      // Only the worker which claimed the job may release it, after its work
      // has stopped. The conditional update preserves cancelled/completed jobs.
      await withTenantTx(txOptions, (tx) =>
        dataRightsRepository.requeueExportJob(tx, payload.exportJobId),
      );
    }
    if (failure.kind === "permanent") {
      await withTenantTx(txOptions, (tx) =>
        dataRightsRepository.markExportJobFailed(tx, {
          exportJobId: payload.exportJobId,
          errorCode: error instanceof ExportLimitError ? error.message : "EXPORT_GENERATION_FAILED",
        }),
      );
    }
    throw failure;
  } finally {
    await file?.cleanup();
  }
}

export async function handleDataRightsOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new OutboxDeliveryError("permanent", "EXPORT_TENANT_REQUIRED");
  }

  const tenantId = event.tenantId;

  await processExportRequestedEvent(
    {
      tenantId,
      actorMembershipId: "00000000-0000-0000-0000-000000000000",
      requestId: event.requestId,
    },
    event,
  );
}

export const dataRightsOutboxHandlers = [
  {
    destinationKey: DATA_EXPORT_WORKER_DESTINATION,
    handle: handleDataRightsOutboxEvent,
  },
];

export const DATA_RIGHTS_OUTBOX_EVENTS = [DATA_EXPORT_REQUESTED_EVENT] as const;
export { DATA_EXPORT_WORKER_DESTINATION };
