import type { TenantTx } from "@atlas/db";
import { createSignedUpload } from "./signed-upload";
import { confirmAssetUpload } from "./asset-reference.service";
import { findAssetReferenceById, findReadyCourseCover } from "./asset-reference.repository";
import { buildPublicSafeAssetUrl } from "./branding-public-url";
import { isInlineSafeContentType } from "./content-disposition";
import { getStorageProvider } from "./providers/storage-provider-factory";
import { parseStorageEnv } from "./schemas/storage-env";

/**
 * Course images (QA review 1 M21, M49). The New course dialog and Settings ›
 * Branding used to show a local preview only and never upload, so no course
 * had an image. Now the image is uploaded to the course and the course keeps a
 * lasting address for it, the way member avatars work.
 */
export async function createCourseCoverUpload(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: {
    courseId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
  },
) {
  return createSignedUpload(tx, ctx, {
    purpose: "course.cover",
    resourceType: "course",
    resourceId: input.courseId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    visibility: "public-safe",
  });
}

/**
 * The image's lasting address: an app route that redirects to a short-lived
 * signed URL. Stored as the course's `coverKey`, so every place that shows a
 * course image (catalogue, course page, Studio) works unchanged.
 */
export function courseCoverPath(assetReferenceId: string): string {
  return `/api/v1/public/course-covers/${assetReferenceId}`;
}

/** Whether `coverKey` is the address of an uploaded course image. */
export function courseCoverIdFromKey(coverKey: string | null | undefined): string | null {
  const match = /^\/api\/v1\/public\/course-covers\/([0-9a-f-]{36})$/i.exec(coverKey ?? "");
  return match?.[1] ?? null;
}

/**
 * Checks the uploaded bytes and makes the image usable. Only an image
 * uploaded to this course is accepted, so one course can't take another's.
 */
export async function confirmCourseCoverUpload(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: { assetReferenceId: string; courseId: string },
): Promise<{ assetReferenceId: string; coverKey: string }> {
  const pending = await findAssetReferenceById(tx, input.assetReferenceId);
  if (
    !pending ||
    pending.purpose !== "course.cover" ||
    pending.resource_type !== "course" ||
    pending.resource_id !== input.courseId
  ) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  const confirmed = await confirmAssetUpload(tx, getStorageProvider(), ctx, {
    assetReferenceId: input.assetReferenceId,
  });

  const coverKey =
    buildPublicSafeAssetUrl({ bucket: confirmed.data.bucket, object_key: confirmed.data.key }) ??
    courseCoverPath(confirmed.data.id);
  return { assetReferenceId: confirmed.data.id, coverKey };
}

/**
 * A short-lived signed URL for a confirmed course image of the current
 * tenant, or null. Only raster images are served.
 */
export async function signCourseCoverDownload(
  tx: TenantTx,
  assetReferenceId: string,
): Promise<string | null> {
  const cover = await findReadyCourseCover(tx, assetReferenceId);
  if (!cover || !isInlineSafeContentType(cover.content_type)) return null;

  const signed = await getStorageProvider().createSignedDownloadUrl({
    bucket: cover.bucket,
    key: cover.object_key,
    expiresInSeconds: parseStorageEnv(process.env).STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
    responseContentType: cover.content_type,
  });
  return signed.url;
}
