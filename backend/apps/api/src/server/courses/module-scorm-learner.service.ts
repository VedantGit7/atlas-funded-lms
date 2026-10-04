import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { findEnrollmentForMembership } from "./courses.repository";
import { moduleNotFound } from "./courses.errors";
import { findModuleWithCourse } from "./course-authoring.repository";
import type { ModuleScormProgressBody } from "./course-authoring-schemas";
import { mintScormContentCapability } from "./scorm-content-capability";
import {
  findModuleScormProgress,
  lockModuleScormProgress,
  upsertModuleScormProgress,
} from "./module-scorm-progress.repository";
import {
  parseScormDurationSeconds,
  SCORM_INTERNAL_PREFIX,
  SCORM_TOTAL_SECONDS_KEY,
} from "./scorm-runtime";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function requireEnrolledScormModule(tx: TenantTx, ctx: ServiceCtx, moduleId: string) {
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
  const scormVersion = normalizeScormVersion(module.scormVersion);
  // A fresh capability per launch: reopening the chapter is how a long session renews it.
  const capability = mintScormContentCapability({
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    moduleId: module.id,
    contentVersion: module.scormContentVersion ?? null,
    scormVersion,
  });
  const contentUrl = `/api/v1/public/scorm/${capability.token}/${launchPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

  return {
    data: {
      moduleId: module.id,
      courseId: module.courseId,
      title: module.title,
      scormVersion,
      launchPath,
      contentUrl,
      launchId: capability.launchId,
      progress: {
        status: normalizeScormProgressStatus(progress?.status),
        progressPct: progress?.progressPct ?? 0,
        completedAt: progress?.completedAt?.toISOString() ?? null,
      },
    },
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
      cmi: publicCmi(progress?.cmiJson ?? {}),
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

/**
 * Chapter progress from either SCORM namespace.
 *
 * 1.2 reports one `lesson_status`; 2004 separates completion from success, and
 * a passed assessment counts as done. A score is not progress (a learner
 * scoring 40% is not 40% through), so only 2004's `progress_measure` moves the
 * percentage before completion.
 */
export function deriveScormProgress(cmi: Record<string, unknown>): {
  status: "not_started" | "in_progress" | "completed";
  progressPct: number;
} {
  const lessonStatus = asCmiString(cmi["cmi.core.lesson_status"]);
  const completionStatus = asCmiString(cmi["cmi.completion_status"]);
  const successStatus = asCmiString(cmi["cmi.success_status"]);
  const completed =
    ["completed", "passed", "failed"].includes(lessonStatus) ||
    completionStatus === "completed" ||
    successStatus === "passed";
  if (completed) return { status: "completed", progressPct: 100 };

  const measureText = asCmiString(cmi["cmi.progress_measure"]);
  const measure = measureText === "" ? Number.NaN : Number(measureText);
  const progressPct = Number.isFinite(measure)
    ? Math.max(0, Math.min(99, Math.round(measure * 100)))
    : 0;
  const started = Object.keys(cmi).some((key) => key.startsWith("cmi."));
  return { status: started ? "in_progress" : "not_started", progressPct };
}

export async function recordModuleScormProgressForLearner(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: ModuleScormProgressBody,
) {
  await requireEnrolledScormModule(tx, ctx, moduleId);

  const existing = await lockModuleScormProgress({
    tx,
    tenantId: ctx.tenantId,
    moduleId,
    membershipId: ctx.actorMembershipId,
  });

  const previousTotal = Number(existing.cmiJson?.[SCORM_TOTAL_SECONDS_KEY] ?? 0);
  const mergedCmi: Record<string, unknown> = { ...(existing.cmiJson ?? {}), ...input.cmi };
  if (input.terminated === true) {
    // Credited once, when the content ends its session; commits repeat session_time.
    const session =
      parseScormDurationSeconds(input.cmi["cmi.session_time"]) ??
      parseScormDurationSeconds(input.cmi["cmi.core.session_time"]) ??
      0;
    mergedCmi[SCORM_TOTAL_SECONDS_KEY] =
      (Number.isFinite(previousTotal) && previousTotal > 0 ? previousTotal : 0) + session;
  }

  const derived = deriveScormProgress(mergedCmi);
  // Completion is sticky: content that reports "incomplete" on a later visit must
  // not take a finished chapter away from the learner.
  const completed =
    existing.status === "completed" || input.completed === true || derived.status === "completed";
  const status = completed ? "completed" : derived.status;
  const progressPct = completed ? 100 : Math.max(existing.progressPct, derived.progressPct);
  const completedAt = completed ? (existing.completedAt ?? new Date()) : null;

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
      cmi: publicCmi(mergedCmi),
      completedAt: saved.completedAt?.toISOString() ?? null,
      lastSeenAt: saved.lastSeenAt?.toISOString() ?? null,
    },
  };
}

/** Saved CMI as the player may see it: internal bookkeeping stays server-side. */
function publicCmi(cmi: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(cmi)) {
    if (key.startsWith(SCORM_INTERNAL_PREFIX)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      result[key] = value;
  }
  return result;
}
