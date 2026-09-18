// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { gradingRepository } from "./grading.repository";
import { gradingTaskNotFound } from "./grading.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function loadGradingTaskResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  taskId: string;
}) {
  const task = await gradingRepository.findById(args.tx, args.taskId);

  if (!task || task.tenant_id !== args.ctx.tenantId) {
    throw gradingTaskNotFound();
  }

  const attempt = await gradingRepository.loadAttemptSummary(args.tx, task.attempt_id);
  if (!attempt) {
    throw gradingTaskNotFound();
  }

  const assessment = await gradingRepository.loadAssessmentSummary(args.tx, attempt.assessmentId);
  if (!assessment) {
    throw gradingTaskNotFound();
  }

  const relationships: Record<string, boolean | string> = {};

  if (task.assigned_to_membership_id === args.ctx.actorMembershipId) {
    relationships["assigneeOfGradingTask"] = args.ctx.actorMembershipId;
  }

  if (assessment.createdByMembershipId === args.ctx.actorMembershipId) {
    relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "grading_task",
    id: task.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: task.assigned_to_membership_id ?? assessment.createdByMembershipId,
    relationships,
  });
}

export function loadGradingQueueResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "grading_queue",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}
