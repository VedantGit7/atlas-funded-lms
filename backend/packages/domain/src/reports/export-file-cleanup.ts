import { randomUUID } from "node:crypto";
import { auditWriter } from "@atlas/audit";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import type { ObjectMetadata } from "@atlas/storage/providers/storage-provider";
import { exportSettingsRepository } from "./export-settings.repository";
import {
  enqueueExportCleanup,
  exportFileCleanupRepository,
  type CleanupRequest,
} from "./export-file-cleanup.repository";

type CleanupContext = { tenantId: string; requestId: string };
type ObjectLocation = { bucket: string; key: string; signal?: AbortSignal };
export type CleanupDependencies = {
  claim: () => Promise<CleanupRequest[]>;
  complete: (request: CleanupRequest) => Promise<boolean>;
  fail: (request: CleanupRequest) => Promise<void>;
  deleteObject: (location: ObjectLocation) => Promise<void>;
  headObject: (location: ObjectLocation) => Promise<ObjectMetadata | null>;
  provider: string;
  bucket: string;
};

function dependencies(ctx: CleanupContext): CleanupDependencies {
  const env = parseStorageEnv(process.env);
  const storage = getStorageProvider();
  const txContext = { ...ctx, allowAnonymousTenantRead: true };
  return {
    provider: env.STORAGE_PROVIDER,
    bucket: env.R2_BUCKET_NAME,
    claim: () =>
      withTenantTx(txContext, async (tx) => {
        await exportSettingsRepository.shortenFileRetention(
          tx,
          await exportSettingsRepository.getFileRetentionMs(tx),
        );
        await enqueueExportCleanup(tx);
        return exportFileCleanupRepository.claim(tx, randomUUID(), 50);
      }),
    complete: (request) =>
      withTenantTx(txContext, async (tx) => {
        const completed = await exportFileCleanupRepository.complete(tx, request);
        if (completed)
          await auditWriter.write(
            tx,
            {
              ...ctx,
              actorMembershipId: null,
              platformPrincipalId: null,
            },
            {
              action: "report.export.file_deleted",
              target: { type: request.source_type, id: request.source_id },
              before: { hasFile: true },
              after: { hasFile: false },
              reason: null,
              metadata: { cleanupRequestId: request.id, absenceVerified: true },
            },
          );
        return completed;
      }),
    fail: (request) =>
      withTenantTx(txContext, (tx) => exportFileCleanupRepository.fail(tx, request)),
    deleteObject: (location) => storage.deleteObject(location),
    headObject: (location) => storage.headObject(location),
  };
}

/** Storage work is outside transactions. Failed work remains durably retryable. */
export async function runExportFileCleanup(ctx: CleanupContext, deps = dependencies(ctx)) {
  const result = { deleted: 0, failed: 0 };
  for (const request of await deps.claim()) {
    try {
      if (request.tenant_id !== ctx.tenantId) throw new Error("Cleanup tenant mismatch.");
      assertTenantKeyPrefix({ tenantId: ctx.tenantId, key: request.object_key });
      if (
        !request.object_key.startsWith(`tenants/${ctx.tenantId}/exports/${request.source_id}/`) ||
        request.object_key.split("/").includes("..")
      ) {
        throw new Error("Cleanup object key does not belong to this export.");
      }
      {
        const manifest = request.artifact_json as { provider?: unknown; bucket?: unknown } | null;
        // Pending uploads can be deleted; verifiedAt is deliberately not required.
        // Legacy files without recorded storage identity require reconciliation.
        if (!manifest || manifest.provider !== deps.provider || manifest.bucket !== deps.bucket) {
          throw new Error("Export cleanup storage identity is unavailable or changed.");
        }
      }
      const location = {
        bucket: deps.bucket,
        key: request.object_key,
        signal: AbortSignal.timeout(30_000),
      };
      await deps.deleteObject(location);
      if (await deps.headObject(location)) throw new Error("Export object is still present.");
      if (await deps.complete(request)) result.deleted += 1;
    } catch {
      result.failed += 1;
      await deps.fail(request);
    }
  }
  return result;
}
