import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { courseNotFound } from "../courses/courses.errors";
import { findCourseForWorkflow, findWorkflowTransitionById } from "./workflows.repository";
import { workflowItemNotFound } from "./workflow.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function loadWorkflowTransitionResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  transitionId: string;
}) {
  const transition = await findWorkflowTransitionById({
    tx: args.tx,
    transitionId: args.transitionId,
  });

  if (!transition) {
    throw workflowItemNotFound();
  }

  if (transition.targetType !== "course") {
    throw workflowItemNotFound();
  }

  const course = await findCourseForWorkflow({
    tx: args.tx,
    courseId: transition.targetId,
  });

  if (!course) {
    throw workflowItemNotFound();
  }

  const relationships: Record<string, boolean | string> = {};

  if (course.createdByMembershipId === args.ctx.actorMembershipId) {
    relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "workflow_transition",
    id: transition.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: course.createdByMembershipId,
    relationships,
  });
}

export async function loadWorkflowQueueResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "workflow_queue",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadCourseWorkflowPreview(args: { tx: TenantTx; courseId: string }) {
  const course = await findCourseForWorkflow({
    tx: args.tx,
    courseId: args.courseId,
  });

  if (!course) {
    throw courseNotFound();
  }

  return course;
}
