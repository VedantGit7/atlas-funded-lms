import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createLessonAssetDownload } from "@atlas/storage/lesson-asset.service";
import { findEnrollmentForMembership } from "../courses/courses.repository";
import type { CreateLessonAssetBody, LessonDetailQuery } from "./lesson-schemas";
import { lessonAssetNotFound, lessonEnrollmentRequired, lessonNotFound } from "./lessons.errors";
import {
  findLessonAssetById,
  findStorageReferenceById,
  insertLessonAsset,
  listLessonAssets,
  softDeleteLessonAsset,
} from "./lesson-assets.repository";
import { findLessonWithModuleAndCourse } from "./lessons.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function requireStudioLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });

  if (!lesson || lesson.tenantId !== ctx.tenantId) {
    throw lessonNotFound();
  }

  if (lesson.createdByMembershipId !== ctx.actorMembershipId) {
    throw lessonNotFound();
  }

  return lesson;
}

async function requireLearnerLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });

  if (!lesson || lesson.tenantId !== ctx.tenantId) {
    throw lessonNotFound();
  }

  if (lesson.courseStatus !== "PUBLISHED" || lesson.status !== "PUBLISHED") {
    throw lessonNotFound();
  }

  const enrollment = await findEnrollmentForMembership({
    tx,
    courseId: lesson.courseId,
    membershipId: ctx.actorMembershipId,
  });

  if (!enrollment) {
    throw lessonEnrollmentRequired();
  }

  return lesson;
}

async function mapAssetProjection(
  tx: TenantTx,
  ctx: ServiceCtx,
  asset: Awaited<ReturnType<typeof listLessonAssets>>[number],
) {
  const metadata = asset.metadataJson ?? {};
  const displayOrder =
    typeof metadata["displayOrder"] === "number" ? metadata["displayOrder"] : null;
  const fileName = typeof metadata["fileName"] === "string" ? metadata["fileName"] : null;
  const contentType = typeof metadata["contentType"] === "string" ? metadata["contentType"] : null;

  if (asset.provider === "r2") {
    try {
      const signed = await createLessonAssetDownload(
        tx,
        { tenantId: ctx.tenantId },
        {
          assetReferenceId: asset.objectKeyOrUrl,
        },
      );

      return {
        id: asset.id,
        assetType: asset.assetType,
        provider: asset.provider,
        fileName,
        contentType,
        displayOrder,
        downloadUrl: signed.data.url,
        downloadExpiresAt: signed.data.expiresAt,
        externalUrl: null,
      };
    } catch {
      return {
        id: asset.id,
        assetType: asset.assetType,
        provider: asset.provider,
        fileName,
        contentType,
        displayOrder,
        downloadUrl: null,
        downloadExpiresAt: null,
        externalUrl: null,
      };
    }
  }

  return {
    id: asset.id,
    assetType: asset.assetType,
    provider: asset.provider,
    fileName,
    contentType,
    displayOrder,
    downloadUrl: null,
    downloadExpiresAt: null,
    externalUrl: asset.objectKeyOrUrl.startsWith("http") ? asset.objectKeyOrUrl : null,
  };
}

export async function listLessonAssetsForLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  query?: LessonDetailQuery,
) {
  if (query?.view === "studio") {
    await requireStudioLesson(tx, ctx, lessonId);
  } else {
    await requireLearnerLesson(tx, ctx, lessonId);
  }

  const assets = await listLessonAssets({ tx, lessonId });
  const items = await Promise.all(assets.map((asset) => mapAssetProjection(tx, ctx, asset)));

  return { data: { items } };
}

export async function attachLessonAsset(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: CreateLessonAssetBody,
) {
  const lesson = await requireStudioLesson(tx, ctx, lessonId);

  if (lesson.courseStatus !== "DRAFT") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Lesson assets can only be attached while the parent course is editable.",
    });
  }

  let objectKeyOrUrl = input.objectKeyOrUrl ?? null;
  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };

  if (input.displayOrder !== undefined) {
    metadata["displayOrder"] = input.displayOrder;
  }

  if (input.storageReferenceId) {
    const storageRef = await findStorageReferenceById({
      tx,
      storageReferenceId: input.storageReferenceId,
    });

    if (!storageRef || storageRef.status !== "READY") {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Storage reference is not ready.",
      });
    }

    if (storageRef.resourceId && storageRef.resourceId !== lessonId) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Storage reference does not belong to this lesson.",
      });
    }

    objectKeyOrUrl = input.storageReferenceId;
    metadata["fileName"] = storageRef.fileName;
    metadata["contentType"] = storageRef.contentType;
  }

  if (!objectKeyOrUrl) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "storageReferenceId or objectKeyOrUrl is required.",
    });
  }

  const created = await insertLessonAsset({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
    assetType: input.assetType,
    provider: input.provider,
    objectKeyOrUrl,
    metadataJson: Object.keys(metadata).length > 0 ? metadata : null,
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
      action: "course.lesson.asset.attached",
      target: { type: "lesson_asset", id: created.id },
      before: null,
      after: { id: created.id, lessonId, assetType: input.assetType },
      reason: null,
      metadata: {},
    },
  );

  const assets = await listLessonAssets({ tx, lessonId });
  const asset = assets.find((item) => item.id === created.id);
  if (!asset) {
    throw lessonAssetNotFound();
  }

  return {
    data: await mapAssetProjection(tx, ctx, asset),
  };
}

export async function removeLessonAsset(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  assetId: string,
) {
  await requireStudioLesson(tx, ctx, lessonId);

  const asset = await findLessonAssetById({ tx, assetId, lessonId });
  if (!asset) {
    throw lessonAssetNotFound();
  }

  await softDeleteLessonAsset({ tx, assetId });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.lesson.asset.removed",
      target: { type: "lesson_asset", id: assetId },
      before: { assetType: asset.assetType, provider: asset.provider },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      id: assetId,
      deleted: true as const,
    },
  };
}
