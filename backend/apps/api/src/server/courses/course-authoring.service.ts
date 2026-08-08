import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  courseNotFound,
  courseSlugConflict,
  courseWorkflowNotConfigured,
  moduleDeleteConflict,
  moduleNotFound,
} from "./courses.errors";
import { findCourseAuthProjection, readCoursePricing } from "./courses.repository";
import type {
  CreateCourseBody,
  CreateModuleBody,
  PublishCourseBody,
  StudioCourseListQuery,
  UpdateCourseBody,
  UpdateModuleBody,
} from "./course-authoring-schemas";
import {
  archiveCourseModuleRecord,
  archiveCourseRecord,
  buildMetadataPatch,
  countActiveEnrollments,
  countModuleLessons,
  courseSlugExists,
  findModuleWithCourse,
  findNextModulePosition,
  findWorkflowDefinitionByKey,
  insertCourseDraft,
  insertCourseModule,
  insertWorkflowTransition,
  listCourseModulesForBuilder,
  listStudioCoursesPaginated,
  metadataProjection,
  updateCourseModuleRecord,
  updateCourseRecord,
  updateCourseStatus,
} from "./course-authoring.repository";
import {
  assertCourseArchivable,
  assertCourseEditable,
  assertCoursePublishable,
  assertModuleEditable,
  validateModulePositions,
  type CourseLifecycleStatus,
} from "./course-state-guards";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function requireOwnedCourse(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await findCourseAuthProjection({ tx, courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  if (course.createdByMembershipId !== ctx.actorMembershipId) {
    throw courseNotFound();
  }

  return course;
}

function mapStudioCourseDetail(course: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  metadataJson: Record<string, unknown> | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  const meta = metadataProjection(course.metadataJson);
  const pricing = readCoursePricing(course.metadataJson);
  const shortDescription =
    course.metadataJson && typeof course.metadataJson["shortDescription"] === "string"
      ? course.metadataJson["shortDescription"]
      : null;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    shortDescription,
    status: course.status as CourseLifecycleStatus,
    coverKey: meta.coverKey,
    tags: meta.tags,
    accessTier: pricing.accessTier,
    priceCents: pricing.priceCents,
    currency: pricing.currency,
    updatedAt: course.updatedAt.toISOString(),
    createdAt: course.createdAt.toISOString(),
  };
}

export async function listStudioCourses(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: StudioCourseListQuery,
) {
  const result = await listStudioCoursesPaginated({
    tx,
    ownerMembershipId: ctx.actorMembershipId,
    query,
  });

  return {
    data: {
      items: result.items.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        status: item.status,
        coverKey: item.coverKey,
        tags: item.tags,
        accessTier: item.accessTier,
        priceCents: item.priceCents,
        currency: item.currency,
        updatedAt: item.updatedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
      pageInfo: result.pageInfo,
    },
  };
}

export async function createCourseDraft(tx: TenantTx, ctx: ServiceCtx, input: CreateCourseBody) {
  const slug = input.slug ?? slugifyTitle(input.title);

  if (!slug) {
    throw courseSlugConflict();
  }

  if (await courseSlugExists({ tx, slug })) {
    throw courseSlugConflict();
  }

  const metadata = buildMetadataPatch({
    ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
    ...(input.coverKey !== undefined ? { coverKey: input.coverKey } : {}),
    ...(input.thumbnailAssetId !== undefined ? { thumbnailAssetId: input.thumbnailAssetId } : {}),
    ...(input.estimatedDuration !== undefined
      ? { estimatedDuration: input.estimatedDuration }
      : {}),
    ...(input.level !== undefined ? { level: input.level } : {}),
    ...(input.stage !== undefined ? { stage: input.stage } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.accessTier !== undefined ? { accessTier: input.accessTier } : {}),
    ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
  });
  const created = await insertCourseDraft({
    tx,
    tenantId: ctx.tenantId,
    ownerMembershipId: ctx.actorMembershipId,
    slug,
    title: input.title,
    description: input.description ?? null,
    metadata,
  });

  const course = await requireOwnedCourse(tx, ctx, created.id);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.created",
      target: { type: "course", id: course.id },
      before: null,
      after: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        status: course.status,
      },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: mapStudioCourseDetail(course),
  };
}

export async function getCourseForBuilder(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await requireOwnedCourse(tx, ctx, courseId);

  return {
    data: mapStudioCourseDetail(course),
  };
}

export async function updateCourse(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: UpdateCourseBody,
) {
  const course = await requireOwnedCourse(tx, ctx, courseId);
  assertCourseEditable(course.status as CourseLifecycleStatus);

  if (input.slug && input.slug !== course.slug) {
    if (await courseSlugExists({ tx, slug: input.slug, excludeCourseId: courseId })) {
      throw courseSlugConflict();
    }
  }

  const metadataPatch = buildMetadataPatch({
    ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
    ...(input.coverKey !== undefined ? { coverKey: input.coverKey } : {}),
    ...(input.thumbnailAssetId !== undefined ? { thumbnailAssetId: input.thumbnailAssetId } : {}),
    ...(input.estimatedDuration !== undefined
      ? { estimatedDuration: input.estimatedDuration }
      : {}),
    ...(input.level !== undefined ? { level: input.level } : {}),
    ...(input.stage !== undefined ? { stage: input.stage } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.accessTier !== undefined ? { accessTier: input.accessTier } : {}),
    ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
  });

  await updateCourseRecord({
    tx,
    courseId,
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(Object.keys(metadataPatch).length > 0 ? { metadataPatch } : {}),
  });

  const updated = await requireOwnedCourse(tx, ctx, courseId);

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
      before: {
        slug: course.slug,
        title: course.title,
        description: course.description,
        status: course.status,
      },
      after: {
        slug: updated.slug,
        title: updated.title,
        description: updated.description,
        status: updated.status,
      },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: mapStudioCourseDetail(updated),
  };
}

export async function archiveOrDeleteCourse(tx: TenantTx, ctx: ServiceCtx, courseId: string) {
  const course = await requireOwnedCourse(tx, ctx, courseId);
  const activeEnrollments = await countActiveEnrollments({ tx, courseId });
  assertCourseArchivable(course.status as CourseLifecycleStatus, activeEnrollments > 0);

  await archiveCourseRecord({ tx, courseId });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.archived",
      target: { type: "course", id: courseId },
      before: {
        status: course.status,
      },
      after: {
        status: "ARCHIVED",
      },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      id: courseId,
      status: "ARCHIVED" as const,
      archivedAt: new Date().toISOString(),
    },
  };
}

export async function listCourseModulesForBuilderService(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
) {
  await requireOwnedCourse(tx, ctx, courseId);
  const modules = await listCourseModulesForBuilder({ tx, courseId });

  return {
    data: {
      items: modules,
    },
  };
}

export async function createCourseModule(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: CreateModuleBody,
) {
  const course = await requireOwnedCourse(tx, ctx, courseId);
  assertModuleEditable(course.status as CourseLifecycleStatus);

  const position = input.position ?? (await findNextModulePosition({ tx, courseId }));
  const created = await insertCourseModule({
    tx,
    tenantId: ctx.tenantId,
    courseId,
    title: input.title,
    position,
    contentKind: input.contentKind,
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
      action: "course.module.created",
      target: { type: "course_module", id: created.id },
      before: null,
      after: {
        id: created.id,
        courseId,
        title: input.title,
        position,
      },
      reason: null,
      metadata: {},
    },
  );

  const modules = await listCourseModulesForBuilder({ tx, courseId });
  const module = modules.find((item) => item.id === created.id);

  return {
    data: module ?? {
      id: created.id,
      title: input.title,
      position,
      status: "DRAFT" as const,
      lessonCount: 0,
      contentKind: input.contentKind ?? "standard",
      scormPackageReady: false,
    },
  };
}

export async function updateCourseModule(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: UpdateModuleBody,
) {
  const module = await findModuleWithCourse({ tx, moduleId });

  if (!module || module.tenantId !== ctx.tenantId) {
    throw moduleNotFound();
  }

  if (module.createdByMembershipId !== ctx.actorMembershipId) {
    throw moduleNotFound();
  }

  assertModuleEditable(module.courseStatus);

  const before = {
    title: module.title,
    position: module.position,
  };

  await updateCourseModuleRecord({
    tx,
    moduleId,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
  });

  const modules = await listCourseModulesForBuilder({ tx, courseId: module.courseId });
  validateModulePositions(modules.map((item) => item.position));

  const updated = modules.find((item) => item.id === moduleId);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.module.updated",
      target: { type: "course_module", id: moduleId },
      before,
      after: {
        title: updated?.title ?? input.title ?? module.title,
        position: updated?.position ?? input.position ?? module.position,
      },
      reason: null,
      metadata: {},
    },
  );

  if (!updated) {
    throw moduleNotFound();
  }

  return {
    data: updated,
  };
}

export async function deleteCourseModule(tx: TenantTx, ctx: ServiceCtx, moduleId: string) {
  const module = await findModuleWithCourse({ tx, moduleId });

  if (!module || module.tenantId !== ctx.tenantId) {
    throw moduleNotFound();
  }

  if (module.createdByMembershipId !== ctx.actorMembershipId) {
    throw moduleNotFound();
  }

  assertModuleEditable(module.courseStatus);

  const lessonCount = await countModuleLessons({ tx, moduleId });
  if (lessonCount > 0) {
    throw moduleDeleteConflict();
  }

  await archiveCourseModuleRecord({ tx, moduleId });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.module.deleted",
      target: { type: "course_module", id: moduleId },
      before: {
        title: module.title,
        position: module.position,
      },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      id: moduleId,
      deleted: true as const,
    },
  };
}

export async function submitCourseForReview(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  input: PublishCourseBody,
) {
  const course = await requireOwnedCourse(tx, ctx, courseId);
  assertCoursePublishable(course.status as CourseLifecycleStatus);

  if (!course.title.trim()) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Course title is required before publishing.",
    });
  }

  const modules = await listCourseModulesForBuilder({ tx, courseId });
  validateModulePositions(modules.map((item) => item.position));

  const workflow = await findWorkflowDefinitionByKey({ tx, key: "course.publish" });
  if (!workflow) {
    throw courseWorkflowNotConfigured();
  }

  const toState = "REVIEW";

  const transition = await insertWorkflowTransition({
    tx,
    tenantId: ctx.tenantId,
    workflowDefinitionId: workflow.id,
    targetType: "course",
    targetId: courseId,
    fromState: "DRAFT",
    toState,
    actorMembershipId: ctx.actorMembershipId,
    reason: input.reason ?? null,
    metadata: {
      action: "submit",
    },
  });

  await updateCourseStatus({
    tx,
    courseId,
    status: toState,
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
      action: "course.submitted_for_review",
      target: { type: "course", id: courseId },
      before: {
        status: course.status,
      },
      after: {
        status: toState,
        workflowTransitionId: transition.id,
      },
      reason: input.reason ?? null,
      metadata: {
        workflowDefinitionId: workflow.id,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "course.submitted_for_review",
    aggregateType: "course",
    aggregateId: courseId,
    payload: {
      courseId,
      workflowTransitionId: transition.id,
      submittedAt: new Date().toISOString(),
    },
    idempotencyKey: `${ctx.requestId}:course.submitted_for_review:${courseId}`,
  });

  return {
    data: {
      id: courseId,
      status: "REVIEW" as const,
      submittedAt: new Date().toISOString(),
      workflowTransitionId: transition.id,
    },
  };
}
