import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";
import { z } from "zod";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import type { ServiceCtx, ExportJobRow } from "./data-rights.types";
import type { ExportSpool } from "./export-spool";

export const exportArtifactSchema = z.object({
  version: z.literal(1),
  provider: z.enum(["r2", "local-fs", "local-mock"]),
  bucket: z.string().min(1),
  contentType: z.literal("application/json"),
  sizeBytes: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  verifiedAt: z.iso.datetime().nullable(),
  retentionStartedAt: z.iso.datetime().optional(),
});
export type ExportArtifact = z.infer<typeof exportArtifactSchema>;
function objectKey(tenantId: string, jobId: string) {
  z.uuid().parse(tenantId);
  z.uuid().parse(jobId);
  return `tenants/${tenantId}/exports/${jobId}/tenant-export.json`;
}
export async function storeExportArtifact(
  ctx: ServiceCtx,
  args: {
    exportJobId: string;
    file: ExportSpool;
    retentionMs: number;
    onPrepared?: (prepared: {
      objectKey: string;
      expiresAt: Date;
      artifact: ExportArtifact;
    }) => Promise<void>;
  },
) {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  if (!provider.putObjectStream || !provider.getObjectStream)
    throw new Error("EXPORT_STREAM_STORAGE_REQUIRED");
  if (!Number.isFinite(args.retentionMs) || args.retentionMs <= 0)
    throw new Error("EXPORT_RETENTION_INVALID");
  const key = objectKey(ctx.tenantId, args.exportJobId);
  const expiresAt = new Date(Date.now() + args.retentionMs);
  const artifact = exportArtifactSchema.parse({
    version: 1,
    provider: env.STORAGE_PROVIDER,
    bucket: env.R2_BUCKET_NAME,
    contentType: "application/json",
    sizeBytes: args.file.sizeBytes,
    checksumSha256: args.file.checksumSha256,
    verifiedAt: null,
    retentionStartedAt: new Date(expiresAt.getTime() - args.retentionMs).toISOString(),
  });
  await args.onPrepared?.({ objectKey: key, expiresAt, artifact });
  const input = { bucket: artifact.bucket, key, signal: AbortSignal.timeout(30_000) };
  const body = createReadStream(args.file.path);
  const sourceClosed = finished(body, { cleanup: true }).catch(() => undefined);
  try {
    await provider.putObjectStream({
      ...input,
      body,
      sizeBytes: artifact.sizeBytes,
      contentType: artifact.contentType,
    });
  } catch (error) {
    // A transport failure cannot prove that a remote PUT did not commit later.
    // Keep its durable reference and require reconciliation before key reuse.
    if (env.STORAGE_PROVIDER === "r2") {
      throw new OutboxDeliveryError("reconciliation_required", "EXPORT_UPLOAD_OUTCOME_UNKNOWN");
    }
    throw error;
  } finally {
    body.destroy();
    await sourceClosed;
  }
  const metadata = await provider.headObject(input);
  if (
    !metadata ||
    metadata.sizeBytes !== artifact.sizeBytes ||
    metadata.contentType !== artifact.contentType
  )
    throw new Error("EXPORT_METADATA_MISMATCH");
  const readback = await provider.getObjectStream(input);
  if (!readback) throw new Error("EXPORT_READBACK_MISSING");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of readback as AsyncIterable<unknown>) {
      input.signal.throwIfAborted();
      if (!Buffer.isBuffer(chunk)) throw new Error("EXPORT_READBACK_INVALID_CHUNK");
      bytes += Buffer.byteLength(chunk);
      if (bytes > artifact.sizeBytes) throw new Error("EXPORT_READBACK_SIZE_MISMATCH");
      hash.update(chunk);
    }
  } finally {
    readback.destroy();
  }
  if (bytes !== artifact.sizeBytes || hash.digest("hex") !== artifact.checksumSha256)
    throw new Error("EXPORT_CHECKSUM_MISMATCH");
  return {
    objectKey: key,
    expiresAt,
    artifact: { ...artifact, verifiedAt: new Date().toISOString() },
  };
}

export async function resolveVerifiedExportDownload(
  ctx: ServiceCtx,
  job: ExportJobRow,
): Promise<{ url: string; expiresAt: string } | null> {
  if (
    job.tenant_id !== ctx.tenantId ||
    job.status !== "SUCCEEDED" ||
    !job.r2_object_key ||
    !job.expires_at
  )
    return null;
  if (job.expires_at.getTime() <= Date.now()) return null;
  const manifest = exportArtifactSchema.safeParse(job.artifact_json);
  if (!manifest.success || !manifest.data.verifiedAt) return null;
  const artifact = manifest.data;
  const env = parseStorageEnv(process.env);
  if (
    artifact.provider !== env.STORAGE_PROVIDER ||
    artifact.bucket !== env.R2_BUCKET_NAME ||
    job.r2_object_key !== objectKey(ctx.tenantId, job.id)
  )
    return null;
  assertTenantKeyPrefix({ tenantId: ctx.tenantId, key: job.r2_object_key });
  const provider = getStorageProvider();
  const metadata = await provider.headObject({
    bucket: artifact.bucket,
    key: job.r2_object_key,
    signal: AbortSignal.timeout(10_000),
  });
  if (
    !metadata ||
    metadata.sizeBytes !== artifact.sizeBytes ||
    metadata.contentType !== artifact.contentType
  )
    return null;
  const ttl = Math.min(
    env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
    Math.floor((job.expires_at.getTime() - Date.now()) / 1000),
  );
  if (ttl < 1) return null;
  const signed = await provider.createSignedDownloadUrl({
    bucket: artifact.bucket,
    key: job.r2_object_key,
    expiresInSeconds: ttl,
  });
  return {
    url: signed.url,
    expiresAt: new Date(
      Math.min(signed.expiresAt.getTime(), job.expires_at.getTime()),
    ).toISOString(),
  };
}
