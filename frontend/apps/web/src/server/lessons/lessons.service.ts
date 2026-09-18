// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { validateProviderVideoRef } from "@atlas/storage/provider-video.service";
import { findModuleWithCourse } from "../courses/course-authoring.repository";
import { moduleNotFound } from "../courses/courses.errors";
import { findEnrollmentForMembership } from "../courses/courses.repository";
import { assertLessonEditable, validateLessonPositions } from "../courses/course-state-guards";
import type { CreateLessonBody, LessonDetailQuery, UpdateLessonBody } from "./lesson-schemas";
import { lessonEnrollmentRequired, lessonNotFound } from "./lessons.errors";
import {
  archiveLessonRecord,
  buildLessonContentJson,
  findLessonWithModuleAndCourse,
  findNextLessonPosition,
  insertLesson,
  lessonSlugExists,
  listLessonsForModuleBuilder,
  listPublishedLessonNavigation,
  listPublishedLessonsForModule,
  mapContentFields,
  updateLessonRecord,
} from "./lessons.repository";
import { findLessonProgress } from "./lesson-progress.repository";
import {
  boundPositionSeconds,
  computePositionSeconds,
  computeProgressPct,
} from "./lesson-progress-guards";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

type VideoProvider = "youtube" | "vimeo" | "bunny";

function asVideoProvider(value: string | null): VideoProvider | null {
  if (value === "youtube" || value === "vimeo" || value === "bunny") {
    return value;
  }
  return null;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function requireOwnedModule(tx: TenantTx, ctx: ServiceCtx, moduleId: string) {
  const module = await findModuleWithCourse({ tx, moduleId });

  if (!module || module.tenantId !== ctx.tenantId) {
    throw moduleNotFound();
  }

  if (module.createdByMembershipId !== ctx.actorMembershipId) {
    throw moduleNotFound();
  }

  return module;
}

async function requireOwnedLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await findLessonWithModuleAndCourse({ tx, lessonId });

  if (!lesson || lesson.tenantId !== ctx.tenantId) {
    throw lessonNotFound();
  }

  if (lesson.createdByMembershipId !== ctx.actorMembershipId) {
    throw lessonNotFound();
  }

  return lesson;
}

function resolveVideoFields(input: { videoProvider?: string; videoUrl?: string }): {
  videoProvider: string | null;
  videoUrl: string | null;
} {
  if (input.videoProvider && input.videoUrl) {
    const validated = validateProviderVideoRef({
      provider: input.videoProvider,
      url: input.videoUrl,
    });
    return { videoProvider: validated.provider, videoUrl: validated.url };
  }

  if (input.videoProvider === undefined && input.videoUrl === undefined) {
    return { videoProvider: null, videoUrl: null };
  }

  throw new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Both videoProvider and videoUrl are required when updating video.",
  });
}

function mapProgressProjection(
  progress: Awaited<ReturnType<typeof findLessonProgress>>,
  durationSeconds: number | null,
) {
  if (!progress) {
    return {
      status: "not_started" as const,
      progressPct: 0,
      positionSeconds: computePositionSeconds(0, durationSeconds),
      completedAt: null,
      lastSeenAt: null,
    };
  }

  return {
    status: progress.status,
    progressPct: progress.progressPct,
    positionSeconds: computePositionSeconds(progress.progressPct, durationSeconds),
    completedAt: progress.completedAt?.toISOString() ?? null,
    lastSeenAt: progress.lastSeenAt?.toISOString() ?? null,
  };
}

export async function listLessonsForModule(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  query?: LessonDetailQuery,
) {
  if (query?.view === "studio") {
    await requireOwnedModule(tx, ctx, moduleId);
    const items = await listLessonsForModuleBuilder({ tx, moduleId });

    return {
      data: {
        items: items.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          position: item.position,
          status: item.status,
          durationSeconds: item.durationSeconds,
        })),
      },
    };
  }

  const module = await findModuleWithCourse({ tx, moduleId });
  if (!module || module.tenantId !== ctx.tenantId || module.courseStatus !== "PUBLISHED") {
    throw moduleNotFound();
  }

  const enrollment = await findEnrollmentForMembership({
    tx,
    courseId: module.courseId,
    membershipId: ctx.actorMembershipId,
  });

  if (!enrollment) {
    throw lessonEnrollmentRequired();
  }

  const items = await listPublishedLessonsForModule({ tx, moduleId });

  return {
    data: {
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        position: item.position,
        durationSeconds: item.durationSeconds,
      })),
    },
  };
}

export async function createLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: CreateLessonBody,
) {
  const module = await requireOwnedModule(tx, ctx, moduleId);
  assertLessonEditable(module.courseStatus);

  const slug = input.slug ?? slugifyTitle(input.title);
  if (!slug) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Lesson slug could not be generated.",
    });
  }

  if (await lessonSlugExists({ tx, moduleId, slug })) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "A lesson with this slug already exists in the module.",
    });
  }

  const video =
    input.videoProvider && input.videoUrl
      ? resolveVideoFields({ videoProvider: input.videoProvider, videoUrl: input.videoUrl })
      : { videoProvider: null, videoUrl: null };

  const position = input.position ?? (await findNextLessonPosition({ tx, moduleId }));

  const created = await insertLesson({
    tx,
    tenantId: ctx.tenantId,
    moduleId,
    slug,
    title: input.title,
    contentJson: buildLessonContentJson({
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.lessonType !== undefined ? { lessonType: input.lessonType } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.isPreview !== undefined ? { isPreview: input.isPreview } : {}),
    }),
    videoProvider: video.videoProvider,
    videoUrl: video.videoUrl,
    durationSeconds: input.durationSeconds ?? null,
    position,
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
      action: "course.lesson.created",
      target: { type: "lesson", id: created.id },
      before: null,
      after: { id: created.id, moduleId, title: input.title, position },
      reason: null,
      metadata: {},
    },
  );

  const items = await listLessonsForModuleBuilder({ tx, moduleId });
  validateLessonPositions(items.map((item) => item.position));
  const lesson = items.find((item) => item.id === created.id);

  return {
    data: lesson ?? {
      id: created.id,
      slug,
      title: input.title,
      position,
      status: "DRAFT" as const,
      durationSeconds: input.durationSeconds ?? null,
    },
  };
}

export async function getLessonForEditor(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await requireOwnedLesson(tx, ctx, lessonId);
  const content = mapContentFields(lesson.contentJson);

  return {
    data: {
      id: lesson.id,
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      slug: lesson.slug,
      title: lesson.title,
      description: content.description,
      lessonType: content.lessonType,
      content: content.content,
      videoProvider: asVideoProvider(lesson.videoProvider),
      videoUrl: lesson.videoUrl,
      durationSeconds: lesson.durationSeconds,
      position: lesson.position,
      status: lesson.status,
      isPreview: content.isPreview,
    },
  };
}

export async function getLessonForPlayer(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
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

  const content = mapContentFields(lesson.contentJson);
  const progress = await findLessonProgress({
    tx,
    lessonId,
    membershipId: ctx.actorMembershipId,
  });
  const navigation = await listPublishedLessonNavigation({
    tx,
    courseId: lesson.courseId,
    currentLessonId: lessonId,
  });

  return {
    data: {
      id: lesson.id,
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      slug: lesson.slug,
      title: lesson.title,
      description: content.description,
      lessonType: content.lessonType,
      content: content.content,
      videoProvider: asVideoProvider(lesson.videoProvider),
      videoUrl: lesson.videoUrl,
      durationSeconds: lesson.durationSeconds,
      position: lesson.position,
      progress: mapProgressProjection(progress, lesson.durationSeconds),
      navigation,
    },
  };
}

export async function getLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  query?: LessonDetailQuery,
) {
  if (query?.view === "studio") {
    return getLessonForEditor(tx, ctx, lessonId);
  }

  return getLessonForPlayer(tx, ctx, lessonId);
}

export async function updateLesson(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: UpdateLessonBody,
) {
  const lesson = await requireOwnedLesson(tx, ctx, lessonId);
  assertLessonEditable(lesson.courseStatus);

  if (input.slug && input.slug !== lesson.slug) {
    if (
      await lessonSlugExists({
        tx,
        moduleId: lesson.moduleId,
        slug: input.slug,
        excludeLessonId: lessonId,
      })
    ) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 409,
        message: "A lesson with this slug already exists in the module.",
      });
    }
  }

  let videoProvider: string | null | undefined;
  let videoUrl: string | null | undefined;

  if (input.videoProvider !== undefined || input.videoUrl !== undefined) {
    if (input.videoProvider && input.videoUrl) {
      const validated = resolveVideoFields({
        videoProvider: input.videoProvider,
        videoUrl: input.videoUrl,
      });
      videoProvider = validated.videoProvider;
      videoUrl = validated.videoUrl;
    } else {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Both videoProvider and videoUrl are required when updating video.",
      });
    }
  }

  const existingContent = mapContentFields(lesson.contentJson);
  const contentJson = buildLessonContentJson({
    ...(input.description !== undefined
      ? { description: input.description }
      : existingContent.description != null
        ? { description: existingContent.description }
        : {}),
    ...(input.lessonType !== undefined
      ? { lessonType: input.lessonType }
      : existingContent.lessonType != null
        ? { lessonType: existingContent.lessonType }
        : {}),
    ...(input.content !== undefined
      ? { content: input.content }
      : existingContent.content != null
        ? { content: existingContent.content }
        : {}),
    ...(input.isPreview !== undefined
      ? { isPreview: input.isPreview }
      : { isPreview: existingContent.isPreview }),
  });

  await updateLessonRecord({
    tx,
    lessonId,
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    contentJson,
    ...(videoProvider !== undefined ? { videoProvider } : {}),
    ...(videoUrl !== undefined ? { videoUrl } : {}),
    ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
  });

  const items = await listLessonsForModuleBuilder({ tx, moduleId: lesson.moduleId });
  validateLessonPositions(items.map((item) => item.position));

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.lesson.updated",
      target: { type: "lesson", id: lessonId },
      before: { title: lesson.title, slug: lesson.slug },
      after: { title: input.title ?? lesson.title, slug: input.slug ?? lesson.slug },
      reason: null,
      metadata: {},
    },
  );

  return getLessonForEditor(tx, ctx, lessonId);
}

export async function archiveOrDeleteLesson(tx: TenantTx, ctx: ServiceCtx, lessonId: string) {
  const lesson = await requireOwnedLesson(tx, ctx, lessonId);
  assertLessonEditable(lesson.courseStatus);

  await archiveLessonRecord({ tx, lessonId });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.lesson.deleted",
      target: { type: "lesson", id: lessonId },
      before: { title: lesson.title, slug: lesson.slug },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      id: lessonId,
      deleted: true as const,
    },
  };
}

export { boundPositionSeconds, computeProgressPct };
