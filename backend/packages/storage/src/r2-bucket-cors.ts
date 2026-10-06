import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import type { BucketCors, CorsRule } from "./r2-cors";
import type { StorageEnv } from "./schemas/storage-env";

/**
 * A bucket's CORS rules through R2's S3 API, for `pnpm storage:r2-cors`
 * (audit M8). Reading and writing them needs an R2 token with admin rights on
 * the bucket, which the runtime never holds: this is for the operator command
 * only. `requestHandler` lets tests replace the network.
 */
export function r2BucketCors(
  env: Pick<
    StorageEnv,
    "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET_NAME"
  >,
  options: { requestHandler?: unknown } = {},
): BucketCors {
  const bucket = env.R2_BUCKET_NAME;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID ?? ""}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
    },
    ...(options.requestHandler ? { requestHandler: options.requestHandler as never } : {}),
  });

  return {
    async get() {
      try {
        const result = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
        return (result.CORSRules ?? []).map((rule) => ({
          AllowedOrigins: rule.AllowedOrigins,
          AllowedMethods: rule.AllowedMethods,
          AllowedHeaders: rule.AllowedHeaders,
          ExposeHeaders: rule.ExposeHeaders,
          MaxAgeSeconds: rule.MaxAgeSeconds,
        })) satisfies CorsRule[];
      } catch (error) {
        // A bucket that has never had CORS rules.
        if ((error as { name?: string }).name === "NoSuchCORSConfiguration") return [];
        throw error;
      }
    },
    async put(rules) {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: {
            CORSRules: rules.map((rule) => ({
              AllowedOrigins: rule.AllowedOrigins ?? [],
              AllowedMethods: rule.AllowedMethods ?? [],
              ...(rule.AllowedHeaders ? { AllowedHeaders: rule.AllowedHeaders } : {}),
              ...(rule.ExposeHeaders ? { ExposeHeaders: rule.ExposeHeaders } : {}),
              ...(rule.MaxAgeSeconds !== undefined ? { MaxAgeSeconds: rule.MaxAgeSeconds } : {}),
            })),
          },
        }),
      );
    },
  };
}
