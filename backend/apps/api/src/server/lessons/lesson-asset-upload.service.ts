import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { confirmAssetUpload } from "@atlas/storage/asset-reference.service";
import {
  findAssetReferenceById,
  updatePendingAssetReferenceSizeBytes,
} from "@atlas/storage/asset-reference.repository";
import { createLessonAssetUpload } from "@atlas/storage/lesson-asset.service";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import type { AssetPurpose } from "@atlas/storage/schemas/storage-policy";
import { assertAllowedSize } from "@atlas/storage/size-policy";
import { findLessonWithModuleAndCourse } from "./lessons.repository";
import { lessonNotFound } from "./lessons.errors";
import { lessonAssetBlobBodySchema, type LessonAssetBlobBody } from "./lesson-schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const LESSON_UPLOAD_PURPOSES = new Set<AssetPurpose>([
  "lesson.asset",
  "lesson.attachment",
  "lesson.thumbnail",
]);

export type LessonAssetUploadBody = {
  purpose: "lesson.asset" | "lesson.attachment" | "lesson.thumbnail";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null | undefined;
};

export type LessonAssetConfirmBody = {
  assetReferenceId: string;
};

function normalizeByteCount(value: bigint | number | string): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return Number(value);
}

export async function parseLessonAssetBlobRequest(req: NextRequest): Promise<LessonAssetBlobBody> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    return lessonAssetBlobBodySchema.parse(await req.json());
  }

  const assetReferenceId = req.headers.get("x-asset-reference-id")?.trim() ?? "";
  const parsedAssetReferenceId = z.string().uuid().safeParse(assetReferenceId);
  if (!parsedAssetReferenceId.success) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "X-Asset-Reference-Id must be a valid UUID.",
    });
  }

  const contentLength = req.headers.get("content-length");
  let contentBuffer: Buffer;
  if (req.body) {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    contentBuffer = Buffer.concat(chunks);
  } else {
    contentBuffer = Buffer.alloc(0);
  }
  console.log(
    "[blob-upload] content-length header:",
    contentLength,
    "| buffer received:",
    contentBuffer.byteLength,
  );

  if (contentBuffer.byteLength === 0) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Uploaded file is empty.",
    });
  }

  return {
    assetReferenceId: parsedAssetReferenceId.data,
    contentBuffer,
  };
}

async function requireEditableStudioLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });

  if (!lesson || lesson.tenantId !== ctx.tenantId) {
    throw lessonNotFound();
  }

  if (lesson.createdByMembershipId !== ctx.actorMembershipId) {
    throw lessonNotFound();
  }

  if (lesson.courseStatus !== "DRAFT") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Lesson uploads are only allowed while the parent course is editable.",
    });
  }

  return lesson;
}

export async function createLessonAssetUploadService(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: LessonAssetUploadBody,
) {
  await requireEditableStudioLesson(tx, ctx, lessonId);

  return createLessonAssetUpload(
    tx,
    { tenantId: ctx.tenantId },
    {
      lessonId,
      purpose: input.purpose,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256 ?? null,
      visibility: input.purpose === "lesson.thumbnail" ? "public-safe" : "private",
    },
  );
}

export async function storeLessonAssetBlobService(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: LessonAssetBlobBody,
) {
  await requireEditableStudioLesson(tx, ctx, lessonId);

  const asset = await findAssetReferenceById(tx, input.assetReferenceId);

  if (!asset || asset.tenant_id !== ctx.tenantId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Asset reference was not found.",
    });
  }

  if (!LESSON_UPLOAD_PURPOSES.has(asset.purpose)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Asset reference is not a lesson upload.",
    });
  }

  if (asset.resource_id !== lessonId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Asset reference does not belong to this lesson.",
    });
  }

  if (asset.status !== "PENDING_UPLOAD") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Lesson asset upload is no longer pending.",
    });
  }

  const body =
    input.contentBuffer ??
    (input.contentBase64 ? Buffer.from(input.contentBase64, "base64") : null);

  if (!body || body.byteLength === 0) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Uploaded file content is missing.",
    });
  }

  const declaredSize = normalizeByteCount(asset.size_bytes);
  const receivedSize = body.byteLength;
  const env = parseStorageEnv(process.env);

  assertAllowedSize({
    purpose: asset.purpose,
    sizeBytes: receivedSize,
    env,
  });

  if (receivedSize < declaredSize) {
    console.log(
      "[blob-upload] SIZE MISMATCH — received:",
      receivedSize,
      "| declared:",
      declaredSize,
    );
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Upload was interrupted before the full file arrived. Please try again.",
    });
  }

  if (receivedSize !== declaredSize) {
    await updatePendingAssetReferenceSizeBytes(tx, input.assetReferenceId, receivedSize);
  }

  const provider = getStorageProvider();
  await provider.putObject({
    bucket: asset.bucket,
    key: asset.object_key,
    body,
    contentType: asset.content_type,
  });

  return {
    data: {
      assetReferenceId: input.assetReferenceId,
      stored: true as const,
    },
  };
}

export async function confirmLessonAssetUploadService(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: LessonAssetConfirmBody,
) {
  await requireEditableStudioLesson(tx, ctx, lessonId);

  const asset = await findAssetReferenceById(tx, input.assetReferenceId);

  if (!asset || asset.tenant_id !== ctx.tenantId || asset.resource_id !== lessonId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Asset reference was not found.",
    });
  }

  if (!LESSON_UPLOAD_PURPOSES.has(asset.purpose)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Asset reference is not a lesson upload.",
    });
  }

  const confirmed = await confirmAssetUpload(
    tx,
    getStorageProvider(),
    { tenantId: ctx.tenantId },
    { assetReferenceId: input.assetReferenceId },
  );

  return confirmed;
}
