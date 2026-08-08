import type { TenantTx } from "@atlas/db";
import { createSignedUpload } from "./signed-upload";
import { createSignedDownload } from "./signed-download";
import { deleteAssetReference } from "./asset-reference.service";
import { getStorageProvider } from "./providers/storage-provider-factory";

export async function createLessonAssetUpload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
  },
  input: {
    lessonId: string;
    purpose: "lesson.asset" | "lesson.attachment" | "lesson.thumbnail";
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
    visibility?: "private" | "public-safe";
  },
) {
  return createSignedUpload(tx, ctx, {
    purpose: input.purpose,
    resourceType: "lesson",
    resourceId: input.lessonId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    visibility: input.visibility ?? "private",
  });
}

export async function createLessonAssetDownload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
  },
  input: {
    assetReferenceId: string;
  },
) {
  return createSignedDownload(tx, ctx, input);
}

export async function removeLessonAssetReference(
  tx: TenantTx,
  ctx: {
    tenantId: string;
  },
  input: {
    assetReferenceId: string;
  },
) {
  return deleteAssetReference(tx, getStorageProvider(), ctx, input);
}
