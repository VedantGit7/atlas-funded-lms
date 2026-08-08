import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type {
  CreateLearningPathBody,
  LearningPathListQuery,
  PathDetailQuery,
  PublishLearningPathBody,
  UpdateLearningPathBody,
} from "./learning-path.schemas";
import {
  assessmentExistsPublished,
  buildStepsWithGates,
  countPathSteps,
  courseExistsPublished,
  findPathAuthProjection,
  findPathEnrollment,
  findWorkflowDefinitionByKey,
  insertPathDraft,
  insertPathEnrollment,
  insertWorkflowTransition,
  listPathStepGates,
  listPathSteps,
  listPublishedPathsPaginated,
  listStudioPathsPaginated,
  mapGateType,
  mapStepType,
  pathExistsPublished,
  pathSlugExists,
  replacePathSteps,
  softDeletePath,
  updatePathRecord,
  updatePathStatus,
} from "./learning-path.repository";
import {
  learningPathEnrollmentDenied,
  learningPathInvalidStepReference,
  learningPathNotEditable,
  learningPathNotFound,
  learningPathNotPublishable,
  learningPathSlugConflict,
  learningPathWorkflowNotConfigured,
} from "./learning-path.errors";
import { buildPathProgress } from "./path-progress.service";
import type { PathLifecycleStatus } from "./learning-path.types";

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

function mapPathSummary(path: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pathType: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
}) {
  return {
    id: path.id,
    slug: path.slug,
    title: path.title,
    description: path.description,
    pathType: path.pathType as "roadmap" | "program",
    status: path.status as PathLifecycleStatus,
    updatedAt: path.updatedAt.toISOString(),
    createdAt: path.createdAt.toISOString(),
  };
}

async function loadPathDetail(tx: TenantTx, pathId: string, membershipId?: string) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path) throw learningPathNotFound();

  const stepsRaw = await listPathSteps({ tx, pathId });
  const gatesRaw = await listPathStepGates({
    tx,
    stepIds: stepsRaw.map((step) => step.id),
  });
  const bundled = buildStepsWithGates(stepsRaw, gatesRaw);

  let enrollmentStatus: "enrolled" | "not_enrolled" = "not_enrolled";
  if (membershipId) {
    const enrollment = await findPathEnrollment({ tx, pathId, membershipId });
    enrollmentStatus = enrollment ? "enrolled" : "not_enrolled";
  }

  return {
    ...mapPathSummary({
      id: path.id,
      slug: path.slug,
      title: path.title,
      description: path.description,
      pathType: path.pathType,
      status: path.status,
      updatedAt: path.updatedAt,
      createdAt: path.createdAt,
    }),
    steps: bundled.map((step) => ({
      id: step.id,
      stepType: mapStepType(step.step_type),
      refId: step.ref_id,
      title: step.title,
      position: step.position,
      gates: step.gates.map((gate) => ({
        id: gate.id,
        gateType: mapGateType(gate.gate_type),
        config: gate.config_json,
      })),
    })),
    enrollmentStatus,
  };
}

async function validateStepReferences(
  tx: TenantTx,
  steps: NonNullable<UpdateLearningPathBody["steps"]>,
) {
  for (const step of steps) {
    if (step.stepType === "course") {
      if (!step.refId || !(await courseExistsPublished({ tx, courseId: step.refId }))) {
        throw learningPathInvalidStepReference(
          "Each course step must reference a published course.",
        );
      }
    }

    if (step.stepType === "assessment") {
      if (!step.refId || !(await assessmentExistsPublished({ tx, assessmentId: step.refId }))) {
        throw learningPathInvalidStepReference(
          "Each assessment step must reference a published assessment.",
        );
      }
    }

    if (step.stepType === "path") {
      if (!step.refId || !(await pathExistsPublished({ tx, pathId: step.refId }))) {
        throw learningPathInvalidStepReference("Each path step must reference a published path.");
      }
    }
  }

  const positions = steps.map((step) => step.position).sort((a, b) => a - b);
  for (let index = 0; index < positions.length; index += 1) {
    if (positions[index] !== index + 1) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Step positions must be contiguous starting at 1.",
      });
    }
  }
}

export async function listLearningPaths(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: LearningPathListQuery,
) {
  if (query.view === "studio") {
    const result = await listStudioPathsPaginated({
      tx,
      ownerMembershipId: ctx.actorMembershipId,
      query,
    });

    return {
      data: {
        items: result.items.map((item) => mapPathSummary(item)),
        pageInfo: result.pageInfo,
      },
    };
  }

  const result = await listPublishedPathsPaginated({ tx, query });

  return {
    data: {
      items: result.items.map((item) => ({
        ...mapPathSummary(item),
        status: "PUBLISHED" as const,
      })),
      pageInfo: result.pageInfo,
    },
  };
}

export async function createLearningPathDraft(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateLearningPathBody,
) {
  const slug = input.slug ?? slugifyTitle(input.title);
  if (!slug) throw learningPathSlugConflict();

  if (await pathSlugExists({ tx, slug })) {
    throw learningPathSlugConflict();
  }

  const created = await insertPathDraft({
    tx,
    tenantId: ctx.tenantId,
    ownerMembershipId: ctx.actorMembershipId,
    slug,
    title: input.title,
    description: input.description ?? null,
    pathType: input.pathType,
    metadata: input.metadata ?? null,
  });

  const path = await loadPathDetail(tx, created.id, ctx.actorMembershipId);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "learning_path.created",
      target: { type: "learning_path", id: created.id },
      before: null,
      after: {
        id: created.id,
        slug: path.slug,
        title: path.title,
        status: path.status,
      },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      id: path.id,
      slug: path.slug,
      title: path.title,
      description: path.description,
      pathType: path.pathType,
      status: path.status,
      updatedAt: path.updatedAt,
      createdAt: path.createdAt,
    },
  };
}

export async function getLearningPathById(
  tx: TenantTx,
  ctx: ServiceCtx,
  pathId: string,
  query: PathDetailQuery,
) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path) throw learningPathNotFound();

  if (query.view !== "studio" && path.status !== "PUBLISHED") {
    throw learningPathNotFound();
  }

  const detail = await loadPathDetail(tx, pathId, ctx.actorMembershipId);
  return { data: detail };
}

export async function updateLearningPath(
  tx: TenantTx,
  ctx: ServiceCtx,
  pathId: string,
  input: UpdateLearningPathBody,
) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path || path.createdByMembershipId !== ctx.actorMembershipId) {
    throw learningPathNotFound();
  }

  if (path.status !== "DRAFT" && path.status !== "REVIEW") {
    throw learningPathNotEditable();
  }

  if (
    input.slug &&
    input.slug !== path.slug &&
    (await pathSlugExists({ tx, slug: input.slug, excludePathId: pathId }))
  ) {
    throw learningPathSlugConflict();
  }

  if (input.steps) {
    await validateStepReferences(tx, input.steps);
  }

  const before = {
    title: path.title,
    slug: path.slug,
    pathType: path.pathType,
  };

  await updatePathRecord({
    tx,
    pathId,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.pathType !== undefined ? { pathType: input.pathType } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });

  if (input.steps) {
    await replacePathSteps({
      tx,
      tenantId: ctx.tenantId,
      pathId,
      steps: input.steps,
    });
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "learning_path.updated",
      target: { type: "learning_path", id: pathId },
      before,
      after: {
        title: input.title ?? path.title,
        slug: input.slug ?? path.slug,
        pathType: input.pathType ?? path.pathType,
        stepCount: input.steps?.length,
      },
      reason: null,
      metadata: {},
    },
  );

  const detail = await loadPathDetail(tx, pathId, ctx.actorMembershipId);
  return { data: detail };
}

export async function deleteLearningPath(tx: TenantTx, ctx: ServiceCtx, pathId: string) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path || path.createdByMembershipId !== ctx.actorMembershipId) {
    throw learningPathNotFound();
  }

  await softDeletePath({ tx, pathId });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "learning_path.deleted",
      target: { type: "learning_path", id: pathId },
      before: { status: path.status, title: path.title },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return { data: { id: pathId, deleted: true as const } };
}

export async function submitLearningPathForReview(
  tx: TenantTx,
  ctx: ServiceCtx,
  pathId: string,
  input: PublishLearningPathBody,
) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path || path.createdByMembershipId !== ctx.actorMembershipId) {
    throw learningPathNotFound();
  }

  if (path.status !== "DRAFT") {
    throw learningPathNotPublishable();
  }

  const stepCount = await countPathSteps({ tx, pathId });
  if (stepCount < 1) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "At least one step is required before publishing.",
    });
  }

  const workflow = await findWorkflowDefinitionByKey({ tx, key: "learning_path.publish" });
  if (!workflow) {
    throw learningPathWorkflowNotConfigured();
  }

  const transition = await insertWorkflowTransition({
    tx,
    tenantId: ctx.tenantId,
    workflowDefinitionId: workflow.id,
    targetType: "learning_path",
    targetId: pathId,
    fromState: "DRAFT",
    toState: "REVIEW",
    actorMembershipId: ctx.actorMembershipId,
    reason: input.reason ?? null,
    metadata: { action: "submit" },
  });

  await updatePathStatus({ tx, pathId, status: "REVIEW" });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "learning_path.submitted_for_review",
      target: { type: "learning_path", id: pathId },
      before: { status: path.status },
      after: { status: "REVIEW", workflowTransitionId: transition.id },
      reason: input.reason ?? null,
      metadata: { workflowDefinitionId: workflow.id },
    },
  );

  return {
    data: {
      id: pathId,
      status: "REVIEW" as const,
      submittedAt: new Date().toISOString(),
      workflowTransitionId: transition.id,
    },
  };
}

export async function enrollCurrentMemberInPath(tx: TenantTx, ctx: ServiceCtx, pathId: string) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path) throw learningPathNotFound();

  if (path.status !== "PUBLISHED") {
    throw learningPathEnrollmentDenied();
  }

  const enrollment = await insertPathEnrollment({
    tx,
    tenantId: ctx.tenantId,
    pathId,
    membershipId: ctx.actorMembershipId,
  });

  return {
    data: {
      id: enrollment.id,
      pathId,
      status: "active" as const,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      created: enrollment.created,
    },
  };
}

export async function getLearningPathProgress(tx: TenantTx, ctx: ServiceCtx, pathId: string) {
  const path = await findPathAuthProjection({ tx, pathId });
  if (!path) throw learningPathNotFound();

  if (path.status !== "PUBLISHED") {
    throw learningPathNotFound();
  }

  const enrollment = await findPathEnrollment({
    tx,
    pathId,
    membershipId: ctx.actorMembershipId,
  });

  const progress = await buildPathProgress(
    tx,
    ctx,
    pathId,
    Boolean(enrollment),
    enrollment?.id ?? null,
    enrollment?.enrolled_at ?? null,
  );

  return { data: progress };
}
