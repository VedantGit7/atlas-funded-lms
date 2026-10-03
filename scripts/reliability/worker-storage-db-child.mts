import { randomUUID } from "node:crypto";
import { withTenantTx } from "../../backend/packages/db/src/with-tenant-tx";
import { drainTenantUsageEvents } from "../../backend/packages/api/src/tenant-usage-meter";
import { runExportFileCleanup } from "../../backend/packages/domain/src/reports/export-file-cleanup";
import { exportFileCleanupRepository } from "../../backend/packages/domain/src/reports/export-file-cleanup.repository";
import { LocalFilesystemStorageProvider } from "../../backend/packages/storage/src/providers/local-filesystem-storage-provider";
import { StorageEnvSchema } from "../../backend/packages/storage/src/schemas/storage-env";

const input = JSON.parse(process.env.ATLAS_WORKER_STORAGE_FIXTURE ?? "null");
const url = new URL(process.env.DATABASE_URL ?? "invalid:");
if (
  !input?.context ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/atlas_lms_test"
)
  throw new Error("Explicit local disposable fixture required");
async function checkpoint(name: string) {
  process.stdout.write(JSON.stringify({ checkpoint: name }) + "\n");
  await new Promise(() => setInterval(() => {}, 1000));
}
let result;
if (input.mode.startsWith("usage")) {
  result = await withTenantTx(input.context, async (tx) => {
    const drained = await drainTenantUsageEvents(tx, { limit: 100 });
    if (input.mode === "usage-crash") await checkpoint("usage-drained-before-commit");
    return drained;
  });
} else {
  const storage = new LocalFilesystemStorageProvider(
    StorageEnvSchema.parse({ STORAGE_LOCAL_ROOT: input.root }),
  );
  result = await runExportFileCleanup(input.context, {
    provider: "local-fs",
    bucket: "fixture",
    claim: () =>
      withTenantTx(input.context, (tx) => exportFileCleanupRepository.claim(tx, randomUUID(), 10)),
    fail: (request) =>
      withTenantTx(input.context, (tx) => exportFileCleanupRepository.fail(tx, request)),
    complete: async (request) => {
      if (input.mode === "cleanup-crash") await checkpoint("object-absent-before-acknowledgement");
      return withTenantTx(input.context, (tx) => exportFileCleanupRepository.complete(tx, request));
    },
    deleteObject: async (location) => {
      if (input.mode === "cleanup-fail") throw new Error("Injected provider outage");
      await storage.deleteObject(location);
    },
    headObject: (location) => storage.headObject(location),
  });
}
process.stdout.write(
  JSON.stringify({ result, peakRssBytes: process.resourceUsage().maxRSS * 1024 }) + "\n",
);
// Deliberately exit without flushing pool handles: all acknowledged work is already committed.
process.exit(0);
