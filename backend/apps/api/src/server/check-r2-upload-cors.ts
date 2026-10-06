import { structuredLogger } from "@atlas/observability/logger";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { CORS_PROBE_KEY, probeUploadPreflight, uploadProbeOrigins } from "@atlas/storage/r2-cors";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";

/**
 * At startup, send R2 the preflight a browser sends before a presigned upload
 * (audit M8). If the bucket's CORS rules would refuse it, every browser upload
 * fails before it starts, with nothing in the API's own logs; this makes it an
 * error event at deploy time instead. Fix it with `pnpm storage:r2-cors`
 * (docs/runbooks/uploaded-files.md).
 *
 * Not awaited and never throws: readiness is not delayed, and an unreachable
 * R2 is reported as a warning, not as a CORS failure.
 */
export async function checkR2UploadCors(): Promise<void> {
  const env = parseStorageEnv(process.env);
  if (env.STORAGE_PROVIDER !== "r2") return;

  let url: string;
  try {
    url = (
      await getStorageProvider().createSignedUploadUrl({
        bucket: env.R2_BUCKET_NAME,
        key: CORS_PROBE_KEY,
        contentType: "image/svg+xml",
        sizeBytes: 1,
        contentDisposition: "attachment",
        expiresInSeconds: 120,
      })
    ).url;
  } catch (error) {
    structuredLogger.warn({
      message: "Could not check the R2 upload CORS rule",
      module: "storage",
      eventType: "storage.r2_cors_check_failed",
      detail: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
    return;
  }

  const results = await Promise.all(
    uploadProbeOrigins(process.env["PLATFORM_HOST"]).map((origin) =>
      probeUploadPreflight({ url, origin }),
    ),
  );
  const unreachable = results.filter((result) => result.status === null);
  const refused = results.filter((result) => !result.ok && result.status !== null);

  if (refused.length > 0) {
    structuredLogger.error({
      message:
        "R2 refuses the browser upload preflight: uploads will fail. Run pnpm storage:r2-cors -- --apply.",
      module: "storage",
      eventType: "storage.r2_cors_misconfigured",
      bucket: env.R2_BUCKET_NAME,
      origins: refused.map((result) => result.origin),
      reasons: refused.map((result) => result.reason ?? "unknown"),
    });
  } else if (unreachable.length > 0) {
    structuredLogger.warn({
      message: "Could not reach R2 to check the upload CORS rule",
      module: "storage",
      eventType: "storage.r2_cors_check_failed",
      detail: unreachable[0]?.reason ?? "unknown",
    });
  } else {
    structuredLogger.info({
      message: "R2 accepts the browser upload preflight",
      module: "storage",
      eventType: "storage.r2_cors_ok",
      bucket: env.R2_BUCKET_NAME,
    });
  }
}
