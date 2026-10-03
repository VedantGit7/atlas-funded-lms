import { createReadStream } from "node:fs";

import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { publishScormPackage } from "../../backend/packages/storage/src/scorm-package-publish";
import { LocalFilesystemStorageProvider } from "../../backend/packages/storage/src/providers/local-filesystem-storage-provider";
import { StorageEnvSchema } from "../../backend/packages/storage/src/schemas/storage-env";

// Only receives explicitly created fixture paths. No application environment file is loaded.
const input = JSON.parse(process.env.ATLAS_WORKER_STORAGE_FIXTURE ?? "null");
if (!input?.root || !input?.source || !input?.version) throw new Error("Fixture required");
const storage = new LocalFilesystemStorageProvider(
  StorageEnvSchema.parse({
    STORAGE_LOCAL_ROOT: input.root,
  }),
);
const start = performance.now();
const files: Array<{ key: string; bytes: number; sha256: string }> = [];
const result = await publishScormPackage({
  source: createReadStream(input.source),
  sizeBytes: input.bytes,
  tenantId: input.tenant,
  moduleId: input.module,
  contentVersion: input.version,
  publish: async ({ key, body, contentType }) => {
    await storage.putObject({ bucket: "fixture", key, body, contentType });
    files.push({
      key,
      bytes: body.length,
      sha256: createHash("sha256").update(body).digest("hex"),
    });
    if (input.interrupt && files.length === 1) {
      process.stdout.write(JSON.stringify({ checkpoint: "first-file-published", key }) + "\n");
      await new Promise(() => setInterval(() => {}, 1000));
    }
  },
});
for (const file of files) {
  const body = await storage.getObjectBody({ bucket: "fixture", key: file.key });
  if (!body || createHash("sha256").update(body).digest("hex") !== file.sha256)
    throw new Error("Published fixture digest mismatch");
}
process.stdout.write(
  JSON.stringify({
    result,
    files,
    elapsedMs: Math.round(performance.now() - start),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    finalRssBytes: process.memoryUsage().rss,
  }) + "\n",
);
