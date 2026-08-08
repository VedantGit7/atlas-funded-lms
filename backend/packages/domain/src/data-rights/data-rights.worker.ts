import { withTenantTx } from "@atlas/db";
import { buildApprovedTenantExport, storeExportArtifact } from "./data-rights-export-runner";
import {
  DATA_EXPORT_REQUESTED_EVENT,
  DATA_EXPORT_WORKER_DESTINATION,
  dataExportRequestedPayloadSchema,
} from "./data-rights.events";
import { dataRightsRepository } from "./data-rights.repository";
import type { ServiceCtx } from "./data-rights.types";

export async function processExportRequestedEvent(
  tx: Parameters<typeof dataRightsRepository.claimExportJobForProcessing>[0],
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (event.eventType !== DATA_EXPORT_REQUESTED_EVENT) {
    return;
  }

  const payload = dataExportRequestedPayloadSchema.parse(event.payload);
  const existing = await dataRightsRepository.findExportJobById(tx, payload.exportJobId);

  if (!existing) {
    return;
  }

  if (existing.status === "SUCCEEDED" || existing.status === "FAILED") {
    return;
  }

  if (existing.status === "RUNNING") {
    return;
  }

  const claimed = await dataRightsRepository.claimExportJobForProcessing(tx, payload.exportJobId);
  if (!claimed) {
    return;
  }

  try {
    const content = await buildApprovedTenantExport(tx, ctx);
    const stored = await storeExportArtifact(tx, ctx, {
      exportJobId: payload.exportJobId,
      content,
    });

    await dataRightsRepository.markExportJobSucceeded(tx, {
      exportJobId: payload.exportJobId,
      objectKey: stored.objectKey,
      expiresAt: stored.expiresAt,
    });
  } catch {
    await dataRightsRepository.markExportJobFailed(tx, {
      exportJobId: payload.exportJobId,
      errorCode: "EXPORT_GENERATION_FAILED",
    });
    throw new Error("EXPORT_GENERATION_FAILED");
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
    throw new Error("Data rights worker requires tenant-scoped events.");
  }

  const tenantId = event.tenantId;

  await withTenantTx(
    {
      tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await processExportRequestedEvent(
        tx,
        {
          tenantId,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId: event.requestId,
        },
        event,
      );
    },
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
