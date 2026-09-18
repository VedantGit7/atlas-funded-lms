// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { findEnrollmentForMembership } from "../courses/courses.repository";
import type { LessonProgressBody } from "./lesson-schemas";
import { lessonEnrollmentRequired, lessonNotFound } from "./lessons.errors";
import {
  boundPositionSeconds,
  computeProgressPct,
  computePositionSeconds,
  isFirstCompletion,
  resolveProgressStatus,
  shouldAdvanceProgressPct,
} from "./lesson-progress-guards";
import { findLessonProgress, upsertLessonProgress } from "./lesson-progress.repository";
import { findLessonWithModuleAndCourse } from "./lessons.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function recordLessonProgress(
  tx: TenantTx,
  ctx: ServiceCtx,
  lessonId: string,
  input: LessonProgressBody,
) {
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

  const existing = await findLessonProgress({
    tx,
    lessonId,
    membershipId: ctx.actorMembershipId,
  });

  const existingStatus = existing?.status ?? "not_started";
  const existingPct = existing?.progressPct ?? 0;
  const completed = input.completed === true || existingStatus === "completed";

  const positionSeconds =
    input.positionSeconds !== undefined
      ? boundPositionSeconds(input.positionSeconds, lesson.durationSeconds)
      : (computePositionSeconds(existingPct, lesson.durationSeconds) ?? 0);

  const nextPct = completed
    ? 100
    : shouldAdvanceProgressPct(
        existingPct,
        computeProgressPct(positionSeconds, lesson.durationSeconds),
        existingStatus,
      );

  const status = resolveProgressStatus({
    existingStatus,
    completed,
    progressPct: nextPct,
  });

  const completedAt =
    status === "completed"
      ? (existing?.completedAt ?? new Date())
      : (existing?.completedAt ?? null);

  const saved = await upsertLessonProgress({
    tx,
    tenantId: ctx.tenantId,
    lessonId,
    membershipId: ctx.actorMembershipId,
    status,
    progressPct: nextPct,
    completedAt,
  });

  if (
    isFirstCompletion({
      existingStatus,
      completed: input.completed === true,
    })
  ) {
    await outbox.publish(tx, {
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      eventType: "lesson.completed",
      aggregateType: "lesson",
      aggregateId: lessonId,
      payload: {
        tenantId: ctx.tenantId,
        lessonId,
        courseId: lesson.courseId,
        moduleId: lesson.moduleId,
        membershipId: ctx.actorMembershipId,
        enrollmentId: enrollment.id,
        completedAt: saved.completedAt?.toISOString() ?? new Date().toISOString(),
      },
      idempotencyKey: `${ctx.requestId}:lesson.completed:${lessonId}:${ctx.actorMembershipId}`,
    });
  }

  return {
    data: {
      status: saved.status,
      progressPct: saved.progressPct,
      positionSeconds: computePositionSeconds(saved.progressPct, lesson.durationSeconds),
      completedAt: saved.completedAt?.toISOString() ?? null,
      lastSeenAt: saved.lastSeenAt?.toISOString() ?? null,
    },
  };
}
