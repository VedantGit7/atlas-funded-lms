import type { TenantTx } from "@atlas/db";
import { parseStorageEnv } from "./schemas/storage-env";
import {
  CreateAssetReferenceInputSchema,
  type CreateAssetReferenceInput,
} from "./schemas/asset-reference";
import { assertAllowedMimeType } from "./mime-policy";
import { assertAllowedSize } from "./size-policy";
import { assertChecksumMatches } from "./checksum";
import { contentDispositionFor } from "./content-disposition";
import { verifyUploadedContent } from "./verify-upload-content";
import { buildTenantStorageKey, assertTenantKeyPrefix } from "./key-builder";
import {
  findAssetReferenceById,
  insertPendingAssetReference,
  markAssetReferenceReady,
  softDeleteAssetReference,
  updatePendingAssetReferenceSizeBytes,
  type StorageReferenceRow,
} from "./asset-reference.repository";
import type { StorageProvider } from "./providers/storage-provider";

function mapAsset(row: StorageReferenceRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    bucket: row.bucket,
    key: row.object_key,
    purpose: row.purpose,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createPendingAssetReferenceWithUpload(
  tx: TenantTx,
  provider: StorageProvider,
  ctx: {
    tenantId: string;
  },
  rawInput: unknown,
) {
  const env = parseStorageEnv(process.env);
  const input: CreateAssetReferenceInput = CreateAssetReferenceInputSchema.parse(rawInput);

  assertAllowedMimeType({
    purpose: input.purpose,
    contentType: input.contentType,
  });

  assertAllowedSize({
    purpose: input.purpose,
    sizeBytes: input.sizeBytes,
    env,
  });

  const key = buildTenantStorageKey({
    tenantId: ctx.tenantId,
    purpose: input.purpose,
    resourceId: input.resourceId,
    fileName: input.fileName,
  });

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key,
  });

  const row = await insertPendingAssetReference(tx, {
    ...input,
    tenantId: ctx.tenantId,
    bucket: env.R2_BUCKET_NAME,
    key,
  });

  const upload = await provider.createSignedUploadUrl({
    bucket: env.R2_BUCKET_NAME,
    key,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    // Audit M8: a type that must not render inline is stored as a download
    // from the moment it is written, before any confirm step.
    contentDisposition: contentDispositionFor(input.contentType, input.fileName),
    expiresInSeconds: env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS,
  });

  return {
    data: {
      asset: mapAsset(row),
      upload: {
        method: "PUT" as const,
        url: upload.url,
        expiresAt: upload.expiresAt.toISOString(),
        requiredHeaders: upload.requiredHeaders,
      },
    },
  };
}

export async function confirmAssetUpload(
  tx: TenantTx,
  provider: StorageProvider,
  ctx: {
    tenantId: string;
  },
  input: {
    assetReferenceId: string;
  },
  options: {
    /**
     * Skip the content check because a later stage parses and validates the
     * bytes itself, and confirm must not read them: the SCORM worker extracts
     * and verifies the archive (F22), and a package can be 100 MB.
     */
    contentVerifiedDownstream?: boolean;
  } = {},
) {
  const asset = await findAssetReferenceById(tx, input.assetReferenceId);

  if (!asset) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key: asset.object_key,
  });

  const metadata = await provider.headObject({
    bucket: asset.bucket,
    key: asset.object_key,
  });

  if (!metadata) {
    throw new Error("ASSET_OBJECT_NOT_FOUND");
  }

  if (metadata.contentType !== asset.content_type) {
    throw new Error("ASSET_CONTENT_TYPE_MISMATCH");
  }

  if (metadata.sizeBytes !== Number(asset.size_bytes)) {
    throw new Error("ASSET_SIZE_MISMATCH");
  }

  assertChecksumMatches({
    expected: asset.checksum_sha256,
    actual: metadata.checksumSha256,
  });

  // Audit M8: the declared type is only a claim. Check the bytes, and replace
  // an SVG with its sanitized form before anything can reference it.
  const rewritten = options.contentVerifiedDownstream
    ? null
    : await verifyUploadedContent(provider, asset);
  if (rewritten) {
    await updatePendingAssetReferenceSizeBytes(tx, asset.id, rewritten.sizeBytes);
  }

  const ready = await markAssetReferenceReady(tx, {
    assetReferenceId: asset.id,
    checksumSha256: rewritten?.checksumSha256 ?? metadata.checksumSha256 ?? asset.checksum_sha256,
  });

  if (!ready) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  return {
    data: mapAsset(ready),
  };
}

export async function createSignedAssetDownload(
  tx: TenantTx,
  provider: StorageProvider,
  ctx: {
    tenantId: string;
  },
  input: {
    assetReferenceId: string;
  },
) {
  const env = parseStorageEnv(process.env);
  const asset = await findAssetReferenceById(tx, input.assetReferenceId);

  if (!asset || asset.status !== "READY") {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key: asset.object_key,
  });

  const signed = await provider.createSignedDownloadUrl({
    bucket: asset.bucket,
    key: asset.object_key,
    expiresInSeconds: env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
    // Forced on the response, so objects stored before audit M8 are covered too.
    responseContentDisposition: contentDispositionFor(asset.content_type, asset.file_name),
    responseContentType: asset.content_type,
  });

  return {
    data: {
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
    },
  };
}

export async function deleteAssetReference(
  tx: TenantTx,
  provider: StorageProvider,
  ctx: {
    tenantId: string;
  },
  input: {
    assetReferenceId: string;
  },
) {
  const asset = await findAssetReferenceById(tx, input.assetReferenceId);

  if (!asset) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key: asset.object_key,
  });

  await softDeleteAssetReference(tx, asset.id);

  // Object deletion may be lifecycle-managed later. Keep this helper available but do not require hard deletion.
  return {
    data: {
      id: asset.id,
      status: "DELETED",
    },
  };
}
