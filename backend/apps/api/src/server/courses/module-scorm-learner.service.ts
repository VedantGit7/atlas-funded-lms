import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import { buildScormContentStorageKey } from "@atlas/storage/scorm-package-extract";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { findEnrollmentForMembership } from "./courses.repository";
import { moduleNotFound } from "./courses.errors";
import { findModuleWithCourse } from "./course-authoring.repository";
import type { ModuleScormProgressBody } from "./course-authoring-schemas";
import {
  findModuleScormProgress,
  upsertModuleScormProgress,
} from "./module-scorm-progress.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function requireEnrolledScormModule(tx: TenantTx, ctx: ServiceCtx, moduleId: string) {
  const module = await findModuleWithCourse({ tx, moduleId });

  if (!module || module.tenantId !== ctx.tenantId) {
    throw moduleNotFound();
  }

  if (module.courseStatus !== "PUBLISHED" || module.status !== "PUBLISHED") {
    throw moduleNotFound();
  }

  if (module.contentKind !== "scorm" || !module.scormLaunchPath) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "SCORM chapter is not available.",
    });
  }

  const enrollment = await findEnrollmentForMembership({
    tx,
    courseId: module.courseId,
    membershipId: ctx.actorMembershipId,
  });

  if (!enrollment) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Enroll in this course to access SCORM chapters.",
    });
  }

  return module;
}

function normalizeScormProgressStatus(
  status: string | null | undefined,
): "not_started" | "in_progress" | "completed" {
  if (status === "in_progress" || status === "completed" || status === "not_started") {
    return status;
  }
  return "not_started";
}

function normalizeScormVersion(version: string | null | undefined): "1.2" | "2004" {
  return version === "2004" ? "2004" : "1.2";
}

export async function getModuleScormLaunchForLearner(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
) {
  const module = await requireEnrolledScormModule(tx, ctx, moduleId);
  const progress = await findModuleScormProgress({
    tx,
    moduleId,
    membershipId: ctx.actorMembershipId,
  });

  const launchPath = module.scormLaunchPath ?? "";
  const contentUrl = `/api/v1/modules/${moduleId}/scorm-content?path=${encodeURIComponent(launchPath)}`;

  return {
    data: {
      moduleId: module.id,
      courseId: module.courseId,
      title: module.title,
      scormVersion: normalizeScormVersion(module.scormVersion),
      launchPath,
      contentUrl,
      progress: {
        status: normalizeScormProgressStatus(progress?.status),
        progressPct: progress?.progressPct ?? 0,
        completedAt: progress?.completedAt?.toISOString() ?? null,
      },
    },
  };
}

export async function getModuleScormContentForLearner(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  relativePath: string,
) {
  const module = await requireEnrolledScormModule(tx, ctx, moduleId);
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();

  // `relativePath` comes straight from a client query parameter. The key builder
  // now rejects traversal instead of silently stripping it, so translate that
  // into a 404 rather than letting a raw Error surface as a 500.
  let key: string;
  try {
    key = buildScormContentStorageKey({
      tenantId: ctx.tenantId,
      moduleId,
      relativePath,
      contentVersion: module.scormContentVersion,
    });
  } catch {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "SCORM content file was not found.",
    });
  }

  const body = await provider.getObjectBody({
    bucket: env.R2_BUCKET_NAME,
    key,
  });

  if (!body) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "SCORM content file was not found.",
    });
  }

  const metadata = await provider.headObject({
    bucket: env.R2_BUCKET_NAME,
    key,
  });

  return {
    body,
    contentType: metadata?.contentType ?? "application/octet-stream",
  };
}

export async function getModuleScormProgressForLearner(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
) {
  await requireEnrolledScormModule(tx, ctx, moduleId);

  const progress = await findModuleScormProgress({
    tx,
    moduleId,
    membershipId: ctx.actorMembershipId,
  });

  return {
    data: {
      status: normalizeScormProgressStatus(progress?.status),
      progressPct: progress?.progressPct ?? 0,
      cmi: (progress?.cmiJson ?? {}) as Record<string, string | number | boolean>,
      completedAt: progress?.completedAt?.toISOString() ?? null,
      lastSeenAt: progress?.lastSeenAt?.toISOString() ?? null,
    },
  };
}

function asCmiString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function deriveProgressFromCmi(cmi: Record<string, unknown>) {
  const lessonStatus = asCmiString(
    cmi["cmi.core.lesson_status"] ?? cmi["cmi.completion_status"] ?? "",
  );
  const scoreRaw = cmi["cmi.core.score.raw"] ?? cmi["cmi.score.raw"];
  const score =
    typeof scoreRaw === "string" || typeof scoreRaw === "number" ? Number(scoreRaw) : null;

  const completed =
    lessonStatus === "completed" || lessonStatus === "passed" || lessonStatus === "failed";

  const progressPct = completed
    ? 100
    : score != null && !Number.isNaN(score)
      ? Math.max(0, Math.min(100, score))
      : 0;
  const status = completed ? "completed" : progressPct > 0 ? "in_progress" : "not_started";

  return {
    status,
    progressPct,
    completedAt: completed ? new Date() : null,
  };
}

export async function recordModuleScormProgressForLearner(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: ModuleScormProgressBody,
) {
  await requireEnrolledScormModule(tx, ctx, moduleId);

  const existing = await findModuleScormProgress({
    tx,
    moduleId,
    membershipId: ctx.actorMembershipId,
  });

  const mergedCmi = {
    ...(existing?.cmiJson ?? {}),
    ...input.cmi,
  };

  const derived = deriveProgressFromCmi(mergedCmi);
  const status = input.completed === true ? "completed" : derived.status;
  const progressPct = input.completed === true ? 100 : derived.progressPct;
  const completedAt =
    status === "completed" ? (existing?.completedAt ?? derived.completedAt ?? new Date()) : null;

  const saved = await upsertModuleScormProgress({
    tx,
    tenantId: ctx.tenantId,
    moduleId,
    membershipId: ctx.actorMembershipId,
    status,
    progressPct,
    cmiJson: mergedCmi,
    completedAt,
  });

  return {
    data: {
      status: normalizeScormProgressStatus(saved.status),
      progressPct: saved.progressPct,
      cmi: mergedCmi as Record<string, string | number | boolean>,
      completedAt: saved.completedAt?.toISOString() ?? null,
      lastSeenAt: saved.lastSeenAt?.toISOString() ?? null,
    },
  };
}
