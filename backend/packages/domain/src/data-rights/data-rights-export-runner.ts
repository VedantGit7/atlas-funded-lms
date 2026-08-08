import type { TenantTx } from "@atlas/db";
import { buildTenantStorageKey, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import { dataRightsRepository } from "./data-rights.repository";
import type { ServiceCtx } from "./data-rights.types";

export async function buildApprovedTenantExport(
  tx: TenantTx,
  ctx: ServiceCtx,
): Promise<Uint8Array> {
  const snapshot = await dataRightsRepository.buildTenantExportSnapshot(tx, ctx.tenantId);
  const json = JSON.stringify(snapshot);
  return new TextEncoder().encode(json);
}

export async function storeExportArtifact(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    exportJobId: string;
    content: Uint8Array;
  },
): Promise<{ objectKey: string; expiresAt: Date }> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  const objectKey = buildTenantStorageKey({
    tenantId: ctx.tenantId,
    purpose: "export.file",
    resourceId: args.exportJobId,
    fileName: "tenant-export.json",
  });

  const upload = await provider.createSignedUploadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
    contentType: "application/json",
    sizeBytes: args.content.byteLength,
    expiresInSeconds: env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS,
  });

  if (env.STORAGE_PROVIDER === "r2") {
    const response = await fetch(upload.url, {
      method: "PUT",
      body: Buffer.from(args.content),
      headers: upload.requiredHeaders,
    });

    if (!response.ok) {
      throw new Error("EXPORT_UPLOAD_FAILED");
    }
  }

  const expiresAt = new Date(Date.now() + env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS * 1000);
  return { objectKey, expiresAt };
}
