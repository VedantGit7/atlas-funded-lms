import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { courseNotFound } from "../courses/courses.errors";
import {
  findAssessmentForWorkflow,
  findCourseForWorkflow,
  findLearningPathForWorkflow,
  findWorkflowTransitionById,
} from "./workflows.repository";
import { workflowItemNotFound } from "./workflow.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

function buildWorkflowRelationships(ownerMembershipId: string | null | undefined) {
  const relationships: Record<string, boolean | string> = {};

  if (ownerMembershipId) {
    relationships["instructorOfCourse"] = ownerMembershipId;
  }

  return relationships;
}

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

  if (transition.targetType === "course") {
    const course = await findCourseForWorkflow({
      tx: args.tx,
      courseId: transition.targetId,
    });

    if (!course) {
      throw workflowItemNotFound();
    }

    return createTenantResourceRef({
      type: "workflow_transition",
      id: transition.id,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: course.createdByMembershipId,
      relationships: buildWorkflowRelationships(course.createdByMembershipId),
    });
  }

  if (transition.targetType === "assessment") {
    const assessment = await findAssessmentForWorkflow({
      tx: args.tx,
      assessmentId: transition.targetId,
    });

    if (!assessment) {
      throw workflowItemNotFound();
    }

    return createTenantResourceRef({
      type: "workflow_transition",
      id: transition.id,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: transition.actorMembershipId,
      relationships: buildWorkflowRelationships(transition.actorMembershipId),
    });
  }

  if (transition.targetType === "learning_path") {
    const path = await findLearningPathForWorkflow({
      tx: args.tx,
      pathId: transition.targetId,
    });

    if (!path) {
      throw workflowItemNotFound();
    }

    const ownerMembershipId = path.createdByMembershipId ?? transition.actorMembershipId;

    return createTenantResourceRef({
      type: "workflow_transition",
      id: transition.id,
      tenantId: args.ctx.tenantId,
      ownerMembershipId,
      relationships: buildWorkflowRelationships(ownerMembershipId),
    });
  }

  throw workflowItemNotFound();
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
