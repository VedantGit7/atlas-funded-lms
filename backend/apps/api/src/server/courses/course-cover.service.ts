import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertLocalBlobUpload, readLocalBlobBody } from "@atlas/storage/local-blob-upload";
import {
  findAssetReferenceById,
  updatePendingAssetReferenceSizeBytes,
} from "@atlas/storage/asset-reference.repository";
import { contentDispositionFor } from "@atlas/storage/content-disposition";
import {
  confirmCourseCoverUpload,
  createCourseCoverUpload,
} from "@atlas/storage/course-cover.service";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import { assertAllowedSize } from "@atlas/storage/size-policy";
import { requireOwnedCourse } from "./course-authoring.service";
import { updateCourseRecord } from "./course-authoring.repository";
import { assertCourseEditable, type CourseLifecycleStatus } from "./course-state-guards";
import type { CourseCoverConfirmBody, CourseCoverUploadBody } from "./course-cover.schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type CourseCoverBlobBody = {
  assetReferenceId: string;
  contentBuffer: Buffer;
};

/** The same rule as editing the course's other settings. */
async function requireEditableCourse(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await requireOwnedCourse(tx, ctx, courseId);
  assertCourseEditable(course.status as CourseLifecycleStatus);
  return course;
}

function coverNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "This image upload was not found. Choose the image again.",
  });
}

export async function createCourseCoverUploadService(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: CourseCoverUploadBody,
) {
  await requireEditableCourse(tx, ctx, courseId);
  return createCourseCoverUpload(
    tx,
    { tenantId: ctx.tenantId },
    {
      courseId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256 ?? null,
    },
  );
}

/** Local development only: the file arrives through the API instead of R2. */
export async function parseCourseCoverBlobRequest(req: NextRequest): Promise<CourseCoverBlobBody> {
  assertLocalBlobUpload();
  const assetReferenceId = z
    .uuid()
    .safeParse(req.headers.get("x-asset-reference-id")?.trim() ?? "");
  if (!assetReferenceId.success) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "X-Asset-Reference-Id must be a valid UUID.",
    });
  }
  const contentBuffer = await readLocalBlobBody(req);
  if (contentBuffer.byteLength === 0) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Uploaded file is empty.",
    });
  }
  return { assetReferenceId: assetReferenceId.data, contentBuffer };
}

export async function storeCourseCoverBlobService(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: CourseCoverBlobBody,
) {
  assertLocalBlobUpload();
  await requireEditableCourse(tx, ctx, courseId);

  const asset = await findAssetReferenceById(tx, input.assetReferenceId);
  if (
    !asset ||
    asset.purpose !== "course.cover" ||
    asset.resource_type !== "course" ||
    asset.resource_id !== courseId
  ) {
    throw coverNotFound();
  }
  if (asset.status !== "PENDING_UPLOAD") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "This image was already uploaded.",
    });
  }

  const body = input.contentBuffer;
  assertAllowedSize({
    purpose: asset.purpose,
    sizeBytes: body.byteLength,
    env: parseStorageEnv(process.env),
  });
  if (body.byteLength !== Number(asset.size_bytes)) {
    await updatePendingAssetReferenceSizeBytes(tx, input.assetReferenceId, body.byteLength);
  }

  await getStorageProvider().putObject({
    bucket: asset.bucket,
    key: asset.object_key,
    body,
    contentType: asset.content_type,
    contentDisposition: contentDispositionFor(asset.content_type, asset.file_name),
  });

  return { data: { assetReferenceId: input.assetReferenceId, stored: true as const } };
}

/**
 * Confirms the upload and makes it the course's image straight away, so an
 * uploaded image is never left unused because a later save failed.
 */
export async function confirmCourseCoverService(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: CourseCoverConfirmBody,
) {
  const course = await requireEditableCourse(tx, ctx, courseId);

  let confirmed: { assetReferenceId: string; coverKey: string };
  try {
    confirmed = await confirmCourseCoverUpload(
      tx,
      { tenantId: ctx.tenantId },
      { assetReferenceId: input.assetReferenceId, courseId },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ASSET_REFERENCE_NOT_FOUND") {
      throw coverNotFound();
    }
    throw error;
  }

  const previousCoverKey =
    typeof course.metadataJson?.["coverKey"] === "string" ? course.metadataJson["coverKey"] : null;

  await updateCourseRecord({
    tx,
    courseId,
    metadataPatch: {
      coverKey: confirmed.coverKey,
      coverAssetId: confirmed.assetReferenceId,
    },
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.updated",
      target: { type: "course", id: courseId },
      before: { coverKey: previousCoverKey },
      after: { coverKey: confirmed.coverKey },
      reason: null,
      metadata: { change: "course_image" },
    },
  );

  return { data: confirmed };
}
