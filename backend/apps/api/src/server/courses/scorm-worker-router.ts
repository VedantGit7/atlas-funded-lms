import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { z } from "zod";
import { withTenantTx } from "@atlas/db";
import {
  processOutboxBatch,
  OutboxDeliveryError,
  type OutboxHandler,
} from "@atlas/events/services/outbox-worker.service";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { publishScormPackage } from "@atlas/storage/scorm-package-publish";
import {
  loadScormProcessingSource,
  completeScormProcessing,
  type ScormSource,
  type ScormWork,
  type ScormCompletion,
} from "./scorm-processing.repository";

const payloadSchema = z.object({ moduleId: z.uuid(), assetReferenceId: z.uuid() });
type Work = ScormWork & { requestId: string };
type Dependencies = {
  load(input: Work): Promise<ScormSource | null>;
  publish(
    input: Work & { source: ScormSource; contentVersion: string },
  ): Promise<{ launchPath: string; scormVersion: string }>;
  complete(input: ScormCompletion & { requestId: string }): Promise<void>;
};
const dependencies: Dependencies = {
  load: (input) =>
    withTenantTx({ ...input, allowAnonymousTenantRead: true }, (tx) =>
      loadScormProcessingSource(tx, input),
    ),
  complete: (input) =>
    withTenantTx({ ...input, allowAnonymousTenantRead: true }, (tx) =>
      completeScormProcessing(tx, input),
    ),
  async publish(input) {
    const provider = getStorageProvider();
    if (!provider.getObjectStream || !provider.putObjectStream)
      throw new Error("SCORM_STREAM_STORAGE_REQUIRED");
    const putObjectStream = provider.putObjectStream.bind(provider);
    const signal = AbortSignal.timeout(4 * 60_000);
    const source = await provider.getObjectStream({
      bucket: input.source.bucket,
      key: input.source.object_key,
      signal,
    });
    if (!source) throw new Error("SCORM_SOURCE_MISSING");
    return publishScormPackage({
      source,
      sizeBytes: Number(input.source.size_bytes),
      tenantId: input.tenantId,
      moduleId: input.moduleId,
      contentVersion: input.contentVersion,
      signal,
      publish: (file) =>
        putObjectStream({
          bucket: input.source.bucket,
          key: file.key,
          contentType: file.contentType,
          body: Readable.from([file.body]),
          sizeBytes: file.body.length,
          signal,
        }),
    });
  },
};

export function createScormHandler(deps: Dependencies = dependencies): OutboxHandler {
  return {
    destinationKey: "scorm.package.process",
    retryOnCrash: true,
    async handle(event) {
      const tenantId = z.uuid().parse(event.tenantId);
      const payload = payloadSchema.parse(event.payload);
      const work = { ...payload, tenantId, requestId: event.requestId };
      const source = await deps.load(work);
      if (!source) return; // An upload replaced before its worker starts is obsolete.
      const contentVersion = randomUUID();
      try {
        const result = await deps.publish({ ...work, source, contentVersion });
        await deps.complete({
          ...work,
          ...result,
          contentVersion,
          eventId: event.id,
          attempt: event.attempt,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          /^SCORM_(ZIP_TOO_LARGE|UPLOAD_SIZE_MISMATCH|ENTRY_TOO_LARGE|PACKAGE_TOO_LARGE|TOO_MANY_ENTRIES|MANIFEST_NOT_FOUND|LAUNCH_FILE_NOT_FOUND|INVALID_PATH|INVALID_ARCHIVE|DUPLICATE_PATH)$/.test(
            error.message,
          )
        )
          throw new OutboxDeliveryError("permanent", error.message);
        throw error;
      }
    },
  };
}

export async function processScormOutboxBatch(args: {
  tenantId: string;
  requestId: string;
  limit?: number;
  maxRetries?: number;
}) {
  return processOutboxBatch(
    {
      transaction: (fn) =>
        withTenantTx(
          { tenantId: args.tenantId, requestId: args.requestId, allowAnonymousTenantRead: true },
          fn,
        ),
    },
    {
      // One archive per invocation bounds memory and lets other tenant queues make progress.
      limit: 1,
      maxRetries: args.maxRetries ?? 3,
      handlers: { "course.module.scorm_processing_requested": [createScormHandler()] },
    },
  );
}
