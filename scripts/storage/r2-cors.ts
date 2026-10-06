/**
 * Apply and verify the R2 bucket CORS rule browser uploads need (audit M8).
 *
 *   <R2 env> PLATFORM_HOST=... pnpm storage:r2-cors
 *   <R2 env> PLATFORM_HOST=... pnpm storage:r2-cors -- --apply
 *
 * R2 env: R2_ACCOUNT_ID, R2_BUCKET_NAME, and an R2 API token with
 * "Admin Read & Write" on that bucket in R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY. Reading and writing a bucket's CORS rules needs admin
 * rights; use this token for this command only, never as the runtime's.
 *
 * Dry run by default: it prints the bucket's rules, whether uploads are
 * allowed, and what --apply would write, then sends a live preflight. With
 * --apply it writes the managed upload rule (other rules are kept) and probes
 * until R2 serves it. Nothing is uploaded.
 *
 * Exit codes: 0 when uploads pass the preflight from every probed origin, 1
 * when they do not, 2 when it could not run.
 */
import {
  CORS_PROBE_KEY,
  UPLOAD_CORS_RULE,
  uploadProbeOrigins,
} from "../../backend/packages/storage/src/r2-cors";
import { R2StorageProvider } from "../../backend/packages/storage/src/providers/r2-storage-provider";
import { parseStorageEnv } from "../../backend/packages/storage/src/schemas/storage-env";
import { r2BucketCors } from "../../backend/packages/storage/src/r2-bucket-cors";
import { syncR2UploadCors } from "./r2-cors-sync";

async function main(): Promise<number> {
  const apply = process.argv.includes("--apply");
  const env = parseStorageEnv({ ...process.env, STORAGE_PROVIDER: "r2" });
  const bucket = env.R2_BUCKET_NAME;
  const provider = new R2StorageProvider(env);

  const report = await syncR2UploadCors({
    bucket,
    apply,
    origins: uploadProbeOrigins(process.env["PLATFORM_HOST"]),
    cors: r2BucketCors(env),
    probeUrl: async () =>
      (
        await provider.createSignedUploadUrl({
          bucket,
          key: CORS_PROBE_KEY,
          contentType: "image/svg+xml",
          sizeBytes: 1,
          contentDisposition: "attachment",
          expiresInSeconds: 120,
        })
      ).url,
  });

  console.log(`Bucket: ${report.bucket}`);
  console.log(`Current rules: ${JSON.stringify(report.before)}`);
  for (const [origin, allowed] of Object.entries(report.allowedBefore)) {
    console.log(
      `  uploads from ${origin}: ${allowed ? "allowed" : "REFUSED"} by the current rules`,
    );
  }
  if (!report.changed) {
    console.log("The upload rule is already in place.");
  } else if (report.written) {
    console.log(`Wrote the upload rule ${JSON.stringify(UPLOAD_CORS_RULE)}`);
    if (report.kept.length > 0) console.log(`Kept ${String(report.kept.length)} other rule(s).`);
  } else {
    console.log(`Dry run. --apply would write ${JSON.stringify(UPLOAD_CORS_RULE)}`);
    if (report.kept.length > 0)
      console.log(`and keep ${String(report.kept.length)} other rule(s).`);
  }
  for (const preflight of report.preflights) {
    console.log(
      `Preflight from ${preflight.origin}: ${preflight.ok ? "passes" : `FAILS (${preflight.reason ?? "unknown"})`}`,
    );
  }
  return report.ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  });
