import { z } from "zod";

export const StorageEnvSchema = z.object({
  STORAGE_PROVIDER: z.enum(["r2", "local-mock", "local-fs"]).default("local-fs"),
  STORAGE_LOCAL_ROOT: z.string().min(1).default(".storage"),
  STORAGE_LOCAL_DOWNLOAD_BASE_PATH: z.string().min(1).default("/api/v1/storage/local/download"),
  STORAGE_LOCAL_PUBLIC_ORIGIN: z.url().default("http://localhost:3000"),
  STORAGE_LOCAL_SIGNING_SECRET: z.string().min(16).default("atlas-local-storage-dev-secret"),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).default("atlas-assets"),
  R2_PUBLIC_ENDPOINT: z.url().optional(),
  STORAGE_SIGNED_UPLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  STORAGE_MAX_BRANDING_ASSET_BYTES: z.coerce.number().int().min(1).default(2_000_000),
  STORAGE_MAX_LESSON_ASSET_BYTES: z.coerce.number().int().min(1).default(100_000_000),
});

export type StorageEnv = z.infer<typeof StorageEnvSchema>;

export function parseStorageEnv(env: NodeJS.ProcessEnv): StorageEnv {
  const parsed = StorageEnvSchema.parse(env);

  if (parsed.STORAGE_PROVIDER === "r2") {
    const missing = [
      ["R2_ACCOUNT_ID", parsed.R2_ACCOUNT_ID],
      ["R2_ACCESS_KEY_ID", parsed.R2_ACCESS_KEY_ID],
      ["R2_SECRET_ACCESS_KEY", parsed.R2_SECRET_ACCESS_KEY],
      ["R2_BUCKET_NAME", parsed.R2_BUCKET_NAME],
    ].filter(([, value]) => !value);

    if (missing.length > 0) {
      throw new Error(
        `R2 storage provider missing required env vars: ${missing.map(([key]) => key).join(", ")}`,
      );
    }
  }

  return parsed;
}
